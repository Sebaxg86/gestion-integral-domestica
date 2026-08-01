import type { InputHTMLAttributes } from "react";

import { cn } from "./lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-12 w-full rounded-[var(--radius-md)] border bg-white px-3.5 text-base text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-disabled)] focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-focus)_20%,transparent)]",
        invalid
          ? "border-[var(--color-danger-700)]"
          : "border-[var(--color-border)]",
        className,
      )}
      {...props}
    />
  );
}
