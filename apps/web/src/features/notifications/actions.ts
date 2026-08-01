"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function markNotificationReadAction(formData: FormData) {
  const notificationId = String(formData.get("notificationId"));
  if (!notificationId) return;
  const supabase = await createClient();
  await supabase.rpc("mark_notification_read", {
    target_notification_id: notificationId,
  });
  revalidatePath("/app/avisos");
}
