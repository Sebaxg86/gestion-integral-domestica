import { Badge, Card, CardContent } from "@gid/ui";
import {
  ExternalLink,
  FileText,
  Package,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { formatDate } from "@/features/documents/expiration";

import {
  archiveServiceAttachmentAction,
  archiveServiceItemAction,
  archiveServicePartAction,
  setServiceItemStatusAction,
} from "./actions";
import { ServiceAttachmentForm } from "./service-attachment-form";
import { ServiceItemForm, ServicePartForm } from "./service-detail-forms";

export type ServiceItemValue = {
  id: string;
  category: string;
  description: string;
  status: string;
  notes: string | null;
  warranty_until: string | null;
  version: number;
};

export type ServicePartValue = {
  id: string;
  vehicle_service_item_id: string | null;
  name: string;
  brand: string | null;
  part_number: string | null;
  quantity: number;
  unit_cost: number | null;
  warranty_until: string | null;
  notes: string | null;
  version: number;
};

export type ServiceAttachmentValue = {
  id: string;
  kind: string;
  title: string;
  original_filename: string;
  size_bytes: number;
  version: number;
  signedUrl: string | null;
};

type ServiceIdentity = {
  vehicleId: string;
  serviceId: string;
};

const itemCategoryLabels: Record<string, string> = {
  oil: "Aceite y lubricación",
  brakes: "Frenos",
  suspension: "Suspensión",
  battery: "Batería",
  tires: "Llantas",
  fluids: "Fluidos",
  filters: "Filtros",
  engine: "Motor",
  transmission: "Transmisión",
  electrical: "Sistema eléctrico",
  body: "Carrocería",
  inspection: "Inspección",
  other: "Otro",
};

const itemStatusLabels: Record<string, string> = {
  reviewed: "Revisado",
  completed: "Realizado",
  pending: "Pendiente",
};

const attachmentKindLabels: Record<string, string> = {
  invoice: "Factura",
  receipt: "Comprobante",
  photo: "Fotografía",
  warranty: "Garantía",
  other: "Otro",
};

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

// ============================================================================
// Secciones del detalle de mantenimiento
// ============================================================================

function HiddenServiceIdentity({ vehicleId, serviceId }: ServiceIdentity) {
  // ===== Conservación del recurso propietario =====

  return (
    <>
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="serviceId" value={serviceId} />
    </>
  );
}

export function ServiceItemsSection({
  vehicleId,
  serviceId,
  items,
}: ServiceIdentity & { items: ServiceItemValue[] }) {
  // ===== Renderizado de trabajos activos =====

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
            Detalle del servicio
          </p>
          <h2 className="mt-1 text-xl font-semibold">Trabajos</h2>
        </div>
        <Badge>{items.length}</Badge>
      </div>

      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <Card key={item.id} className="shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{item.description}</h3>
                    <Badge>{itemStatusLabels[item.status] ?? item.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {itemCategoryLabels[item.category] ?? item.category}
                  </p>
                </div>
                <form action={archiveServiceItemAction}>
                  <HiddenServiceIdentity
                    vehicleId={vehicleId}
                    serviceId={serviceId}
                  />
                  <input type="hidden" name="itemId" value={item.id} />
                  <input type="hidden" name="version" value={item.version} />
                  <button
                    className="grid size-11 place-items-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]"
                    type="submit"
                    aria-label={`Quitar ${item.description}`}
                  >
                    <Trash2 aria-hidden size={17} />
                  </button>
                </form>
              </div>
              {item.notes ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                  {item.notes}
                </p>
              ) : null}
              {item.warranty_until ? (
                <p className="mt-3 flex items-center gap-2 text-sm">
                  <ShieldCheck
                    aria-hidden
                    className="text-[var(--color-brand-800)]"
                    size={17}
                  />
                  Garantía hasta {formatDate(item.warranty_until)}
                </p>
              ) : null}
              <form
                action={setServiceItemStatusAction}
                className="mt-4 flex gap-2 border-t pt-4"
              >
                <HiddenServiceIdentity
                  vehicleId={vehicleId}
                  serviceId={serviceId}
                />
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="version" value={item.version} />
                <select
                  className="min-h-11 flex-1 rounded-lg border bg-white px-3 text-sm"
                  name="status"
                  defaultValue={item.status}
                  aria-label={`Estado de ${item.description}`}
                >
                  <option value="completed">Realizado</option>
                  <option value="reviewed">Revisado</option>
                  <option value="pending">Pendiente</option>
                </select>
                <button
                  className="min-h-11 px-2 text-sm font-semibold text-[var(--color-brand-800)]"
                  type="submit"
                >
                  Actualizar
                </button>
              </form>
            </CardContent>
          </Card>
        ))}
        {!items.length ? (
          <p className="rounded-2xl bg-[var(--color-surface-alt)] p-5 text-sm text-[var(--color-text-secondary)]">
            Aún no hay trabajos desglosados en este servicio.
          </p>
        ) : null}
      </div>

      {/* ===== Captura de un nuevo trabajo ===== */}

      <details className="mt-3 rounded-2xl border bg-white p-5">
        <summary className="cursor-pointer font-semibold">
          Agregar trabajo
        </summary>
        <div className="mt-5 border-t pt-5">
          <ServiceItemForm vehicleId={vehicleId} serviceId={serviceId} />
        </div>
      </details>
    </section>
  );
}

export function ServicePartsSection({
  vehicleId,
  serviceId,
  items,
  parts,
}: ServiceIdentity & {
  items: ServiceItemValue[];
  parts: ServicePartValue[];
}) {
  // ===== Preparación de relaciones y totales =====

  const itemById = new Map(items.map((item) => [item.id, item]));

  // ===== Renderizado de refacciones activas =====

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
          <Package aria-hidden size={19} />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Refacciones</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Piezas y consumibles utilizados
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {parts.map((part) => {
          const relatedItem = part.vehicle_service_item_id
            ? itemById.get(part.vehicle_service_item_id)
            : null;
          const total =
            part.unit_cost === null
              ? null
              : Number(part.quantity) * Number(part.unit_cost);

          return (
            <Card key={part.id} className="shadow-none">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{part.name}</h3>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {[part.brand, part.part_number]
                        .filter(Boolean)
                        .join(" · ") || "Sin marca o número de parte"}
                    </p>
                  </div>
                  <form action={archiveServicePartAction}>
                    <HiddenServiceIdentity
                      vehicleId={vehicleId}
                      serviceId={serviceId}
                    />
                    <input type="hidden" name="partId" value={part.id} />
                    <input type="hidden" name="version" value={part.version} />
                    <button
                      className="grid size-11 place-items-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]"
                      type="submit"
                      aria-label={`Quitar ${part.name}`}
                    >
                      <Trash2 aria-hidden size={17} />
                    </button>
                  </form>
                </div>
                <p className="mt-4 text-sm">
                  {Number(part.quantity).toLocaleString("es-MX")} unidad(es)
                  {total === null
                    ? ""
                    : ` · ${currencyFormatter.format(total)}`}
                </p>
                {relatedItem ? (
                  <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                    Trabajo: {relatedItem.description}
                  </p>
                ) : null}
                {part.warranty_until ? (
                  <p className="mt-3 flex items-center gap-2 text-sm">
                    <ShieldCheck
                      aria-hidden
                      className="text-[var(--color-brand-800)]"
                      size={17}
                    />
                    Garantía hasta {formatDate(part.warranty_until)}
                  </p>
                ) : null}
                {part.notes ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                    {part.notes}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {!parts.length ? (
          <p className="rounded-2xl bg-[var(--color-surface-alt)] p-5 text-sm text-[var(--color-text-secondary)] sm:col-span-2">
            Aún no hay refacciones registradas.
          </p>
        ) : null}
      </div>

      {/* ===== Captura de una nueva refacción ===== */}

      <details className="mt-3 rounded-2xl border bg-white p-5">
        <summary className="cursor-pointer font-semibold">
          Agregar refacción
        </summary>
        <div className="mt-5 border-t pt-5">
          <ServicePartForm
            vehicleId={vehicleId}
            serviceId={serviceId}
            items={items.map((item) => ({
              id: item.id,
              description: item.description,
            }))}
          />
        </div>
      </details>
    </section>
  );
}

export function ServiceAttachmentsSection({
  familyId,
  vehicleId,
  serviceId,
  attachments,
}: ServiceIdentity & {
  familyId: string;
  attachments: ServiceAttachmentValue[];
}) {
  // ===== Renderizado de archivos activos =====

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-brand-800)]">
          <FileText aria-hidden size={19} />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Archivos</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Facturas, comprobantes, garantías y fotografías
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <Card key={attachment.id} className="shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{attachment.title}</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {attachmentKindLabels[attachment.kind] ?? attachment.kind}
                    {" · "}
                    {(attachment.size_bytes / 1024 / 1024).toFixed(2)} MiB
                  </p>
                </div>
                <form action={archiveServiceAttachmentAction}>
                  <HiddenServiceIdentity
                    vehicleId={vehicleId}
                    serviceId={serviceId}
                  />
                  <input
                    type="hidden"
                    name="attachmentId"
                    value={attachment.id}
                  />
                  <input
                    type="hidden"
                    name="version"
                    value={attachment.version}
                  />
                  <button
                    className="grid size-11 place-items-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)]"
                    type="submit"
                    aria-label={`Quitar ${attachment.title}`}
                  >
                    <Trash2 aria-hidden size={17} />
                  </button>
                </form>
              </div>
              <p className="mt-3 truncate text-sm text-[var(--color-text-secondary)]">
                {attachment.original_filename}
              </p>
              {attachment.signedUrl ? (
                <a
                  className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-brand-800)]"
                  href={attachment.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir archivo <ExternalLink aria-hidden size={16} />
                </a>
              ) : (
                <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                  El enlace temporal no está disponible.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {!attachments.length ? (
          <p className="rounded-2xl bg-[var(--color-surface-alt)] p-5 text-sm text-[var(--color-text-secondary)] sm:col-span-2">
            Aún no hay archivos asociados con este servicio.
          </p>
        ) : null}
      </div>

      {/* ===== Carga de nuevos archivos ===== */}

      <details className="mt-3 rounded-2xl border bg-white p-5">
        <summary className="cursor-pointer font-semibold">
          Agregar archivos
        </summary>
        <div className="mt-5 border-t pt-5">
          <ServiceAttachmentForm
            familyId={familyId}
            vehicleId={vehicleId}
            serviceId={serviceId}
          />
        </div>
      </details>
    </section>
  );
}
