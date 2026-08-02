import { createClient } from "@/lib/supabase/server";

import type { TaskFormOptions } from "./task-form";

// ============================================================================
// Consultas compartidas de pendientes
// ============================================================================

export async function getTaskFormOptions(
  familyId: string,
): Promise<TaskFormOptions> {
  // ===== Consulta paralela de relaciones activas =====

  const supabase = await createClient();
  const [{ data: properties }, { data: vehicles }, { data: services }] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id, name")
        .eq("family_id", familyId)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("vehicles")
        .select("id, name")
        .eq("family_id", familyId)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("scheduled_services")
        .select("id, name")
        .eq("family_id", familyId)
        .eq("status", "active")
        .order("name"),
    ]);

  // ===== Normalización para el formulario =====

  return {
    properties: properties ?? [],
    vehicles: vehicles ?? [],
    services: services ?? [],
  };
}
