import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "./lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-brand-700)] text-white shadow-[var(--shadow-control)] hover:bg-[var(--color-brand-800)] active:bg-[var(--color-brand-900)]",
        secondary:
          "border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-surface-alt)]",
        tertiary:
          "text-[var(--color-brand-800)] hover:bg-[var(--color-brand-100)]",
        danger:
          "bg-[var(--color-danger-700)] text-white hover:bg-[var(--color-danger-800)]",
      },
      size: {
        mobile: "min-h-12",
        desktop: "min-h-11",
        icon: "size-11 px-0",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "desktop",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  fullWidth,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
