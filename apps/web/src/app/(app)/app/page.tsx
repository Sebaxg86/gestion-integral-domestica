import { Badge, buttonVariants, Card, CardContent } from "@gid/ui";
import { ArrowRight, Bell, FileText, House, Plus } from "lucide-react";
import Link from "next/link";

import {
  classifyExpiration,
  daysUntil,
  formatDate,
  getLocalDate,
} from "@/features/documents/expiration";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type DashboardDocument = {
  id: string;
  name: string;
  expiration_date: string;
  property: { name: string };
};

const statusCopy = {
  expired: "Vencido",
  today: "Vence hoy",
  upcoming: "Próximo",
} as const;

export default async function DashboardPage() {
  const context = await getSessionContext();
  const supabase = await createClient();
  const family = context!.family!;
  const localDate = getLocalDate(family.timezone);

  const [
    { data: propertyRows },
    { data: documentRows },
    { count: unreadCount },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id")
      .eq("family_id", family.id)
      .eq("status", "active"),
    supabase
      .from("documents")
      .select("id, name, expiration_date, property:properties!inner(name)")
      .eq("family_id", family.id)
      .eq("status", "active")
      .eq("properties.status", "active")
      .not("expiration_date", "is", null)
      .order("expiration_date", { ascending: true }),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("family_id", family.id)
      .eq("status", "unread"),
  ]);

  const documents = (documentRows ?? []) as unknown as DashboardDocument[];
  const attentionDocuments = documents.filter(
    (document) =>
      classifyExpiration(document.expiration_date, localDate) !== "later",
  );

  if (!propertyRows?.length) {
    return (
      <section className="mx-auto max-w-3xl py-8 sm:py-16">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-[var(--color-brand-800)]">
            Tu espacio está listo
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Agrega tu primera vivienda.
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--color-text-secondary)]">
            Será el contexto para guardar documentos y organizar sus
            vencimientos.
          </p>
          <Link
            className={`${buttonVariants({ variant: "primary", size: "mobile" })} mt-7`}
            href="/app/viviendas/nueva"
          >
            <Plus aria-hidden size={18} /> Agregar vivienda
          </Link>
        </div>
        <Card className="mt-10 bg-[var(--color-surface-alt)] shadow-none">
          <CardContent className="grid gap-5 p-6 sm:grid-cols-3">
            <EmptyStep icon={House} number="1" text="Registra una vivienda" />
            <EmptyStep icon={FileText} number="2" text="Guarda un documento" />
            <EmptyStep icon={Bell} number="3" text="Configura su aviso" />
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {family.name}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">
            Lo que requiere atención
          </h1>
        </div>
        <Link
          className={buttonVariants({ variant: "secondary", size: "icon" })}
          href="/app/avisos"
          aria-label={`${unreadCount ?? 0} avisos sin leer`}
        >
          <Bell aria-hidden size={19} />
        </Link>
      </div>

      <div className="mt-8 grid gap-3">
        {attentionDocuments.length ? (
          attentionDocuments.map((document) => {
            const status = classifyExpiration(
              document.expiration_date,
              localDate,
            );
            const difference = daysUntil(document.expiration_date, localDate);
            if (status === "later") return null;
            return (
              <Link href={`/app/documentos/${document.id}`} key={document.id}>
                <Card className="transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-overlay)]">
                  <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
                      <FileText aria-hidden size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">
                          {document.name}
                        </p>
                        <Badge status={status}>{statusCopy[status]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {document.property.name} ·{" "}
                        {formatDate(document.expiration_date)}
                        {status === "upcoming" ? ` · ${difference} días` : ""}
                      </p>
                    </div>
                    <ArrowRight
                      aria-hidden
                      className="text-[var(--color-text-disabled)]"
                      size={18}
                    />
                  </CardContent>
                </Card>
              </Link>
            );
          })
        ) : (
          <Card className="bg-[var(--color-surface-alt)] shadow-none">
            <CardContent className="p-7 text-center">
              <p className="font-semibold">Nada urgente por ahora</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Los próximos 30 días están despejados.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function EmptyStep({
  icon: Icon,
  number,
  text,
}: {
  icon: typeof House;
  number: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 sm:block">
      <span className="grid size-10 place-items-center rounded-xl bg-white text-[var(--color-brand-800)] shadow-[var(--shadow-control)]">
        <Icon aria-hidden size={19} />
      </span>
      <p className="mt-0 text-sm font-medium sm:mt-3">
        <span className="text-[var(--color-text-disabled)]">{number}.</span>{" "}
        {text}
      </p>
    </div>
  );
}
