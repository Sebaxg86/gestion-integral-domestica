import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      className="inline-flex items-center gap-2.5 font-semibold tracking-[-0.02em]"
      href={href}
    >
      <span className="grid size-9 place-items-center rounded-xl bg-[var(--color-brand-700)] text-sm font-bold text-white shadow-[var(--shadow-control)]">
        G
      </span>
      <span>GID</span>
    </Link>
  );
}
