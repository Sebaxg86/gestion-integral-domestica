import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

import { cn } from "./lib/cn";

export function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-2", className)} {...props} />;
}

export function FieldLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-sm font-semibold text-[var(--color-text-primary)]",
        className,
      )}
      {...props}
    />
  );
}

export function FieldMessage({
  children,
  error,
}: {
  children?: ReactNode;
  error?: boolean;
}) {
  if (!children) return null;

  return (
    <p
      className={cn(
        "text-xs leading-4",
        error
          ? "text-[var(--color-danger-700)]"
          : "text-[var(--color-text-secondary)]",
      )}
    >
      {children}
    </p>
  );
}
