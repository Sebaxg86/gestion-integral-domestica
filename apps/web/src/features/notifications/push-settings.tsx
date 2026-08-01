"use client";

import { Button } from "@gid/ui";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/browser";

type PushState = "checking" | "unsupported" | "disabled" | "enabled";

function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
}

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = window.atob(normalized);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function PushSettings({ userId }: { userId: string }) {
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    async function checkSubscription() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        !getVapidPublicKey()
      ) {
        setState("unsupported");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState(subscription ? "enabled" : "disabled");
    }

    void checkSubscription().catch(() => {
      setState("unsupported");
    });
  }, []);

  async function enablePush() {
    const vapidPublicKey = getVapidPublicKey();
    if (!vapidPublicKey) return;

    setPending(true);
    setMessage(undefined);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("No concediste permiso para recibir notificaciones.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
        }));
      const subscriptionData = subscription.toJSON();
      const p256dh = subscriptionData.keys?.p256dh;
      const auth = subscriptionData.keys?.auth;
      if (!subscription.endpoint || !p256dh || !auth) {
        setMessage("No pudimos preparar este dispositivo para notificaciones.");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 500),
          active: true,
        },
        { onConflict: "endpoint" },
      );
      if (error) {
        setMessage("No pudimos guardar la configuración de este dispositivo.");
        return;
      }

      setState("enabled");
      setMessage("Las notificaciones están activadas en este dispositivo.");
    } catch {
      setMessage("No pudimos activar las notificaciones. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  async function disablePush() {
    setPending(true);
    setMessage(undefined);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setState("disabled");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", subscription.endpoint);
      if (error) {
        setMessage("No pudimos desactivar las notificaciones todavía.");
        return;
      }

      await subscription.unsubscribe();
      setState("disabled");
      setMessage("Las notificaciones se desactivaron en este dispositivo.");
    } catch {
      setMessage("No pudimos desactivar las notificaciones. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  if (state === "unsupported") {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Este navegador no admite notificaciones. En iPhone, instala GID desde
        Safari en la pantalla de inicio y ábrela desde ahí.
      </p>
    );
  }

  if (state === "checking") {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Comprobando este dispositivo…
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Recibe avisos de vencimientos incluso cuando GID está cerrada.
      </p>
      <Button
        disabled={pending}
        variant={state === "enabled" ? "secondary" : "primary"}
        type="button"
        onClick={state === "enabled" ? disablePush : enablePush}
      >
        {state === "enabled" ? (
          <BellOff aria-hidden size={17} />
        ) : (
          <Bell aria-hidden size={17} />
        )}
        {pending
          ? "Guardando…"
          : state === "enabled"
            ? "Desactivar en este dispositivo"
            : "Activar notificaciones"}
      </Button>
      {message ? (
        <p className="text-sm text-[var(--color-text-secondary)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
