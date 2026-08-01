import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type PushDelivery = {
  id: string;
  attempt_count: number;
  notification: {
    id: string;
    title: string;
    message: string;
    reminder: { document_id: string } | null;
  } | null;
  subscription: {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  } | null;
};

// ============== Procesamiento de recordatorios ==============

// ==== Construir respuesta HTTP ====

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// ==== Procesar vencimientos y entregas push ====

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  const authorization = request.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return jsonResponse({ code: "UNAUTHORIZED" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ code: "SERVER_CONFIGURATION" }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient.rpc("process_due_reminders", {
    batch_size: 100,
  });

  if (error) {
    return jsonResponse({ code: "REMINDER_PROCESS_FAILED" }, 500);
  }

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return jsonResponse({ processed: data, pushed: 0 }, 200);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const { data: deliveryRows, error: deliveryError } = await adminClient
    .from("push_deliveries")
    .select(
      "id, attempt_count, notification:notifications(id, title, message, reminder:reminders(document_id)), subscription:push_subscriptions(id, endpoint, p256dh, auth)",
    )
    .eq("status", "queued")
    .lt("attempt_count", 5)
    .order("created_at", { ascending: true })
    .limit(100);

  if (deliveryError) {
    return jsonResponse({ code: "PUSH_DELIVERY_QUERY_FAILED" }, 500);
  }

  let pushed = 0;
  for (const delivery of (deliveryRows ?? []) as unknown as PushDelivery[]) {
    if (!delivery.notification || !delivery.subscription) {
      await adminClient
        .from("push_deliveries")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          last_error: "La notificación o suscripción ya no existe.",
        })
        .eq("id", delivery.id);
      continue;
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: delivery.subscription.endpoint,
          keys: {
            p256dh: delivery.subscription.p256dh,
            auth: delivery.subscription.auth,
          },
        },
        JSON.stringify({
          title: delivery.notification.title,
          body: delivery.notification.message,
          url: delivery.notification.reminder
            ? `/app/documentos/${delivery.notification.reminder.document_id}`
            : "/app/avisos",
          tag: delivery.notification.id,
        }),
        { TTL: 60 * 60 * 24, urgency: "high" },
      );
      await adminClient
        .from("push_deliveries")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempt_count: 1,
          last_error: null,
        })
        .eq("id", delivery.id);
      pushed += 1;
    } catch (pushError) {
      const statusCode = (pushError as { statusCode?: number }).statusCode;
      const isInvalidSubscription = statusCode === 404 || statusCode === 410;
      const nextAttemptCount = Math.min(delivery.attempt_count + 1, 5);
      const exhaustedAttempts = nextAttemptCount === 5;
      await adminClient
        .from("push_deliveries")
        .update({
          status: isInvalidSubscription || exhaustedAttempts ? "failed" : "queued",
          failed_at:
            isInvalidSubscription || exhaustedAttempts
              ? new Date().toISOString()
              : null,
          attempt_count: nextAttemptCount,
          last_error: `El servicio push respondió con ${statusCode ?? "un error"}.`,
        })
        .eq("id", delivery.id);
      if (isInvalidSubscription) {
        await adminClient
          .from("push_subscriptions")
          .update({ active: false })
          .eq("id", delivery.subscription.id);
      }
    }
  }

  return jsonResponse({ processed: data, pushed }, 200);
});

// ===================================================
