import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "./lib/cn";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold",
  {
    variants: {
      status: {
        expired: "bg-red-50 text-[var(--color-danger-700)]",
        today: "bg-amber-50 text-[var(--color-warning-700)]",
        upcoming: "bg-blue-50 text-[var(--color-info-700)]",
        success: "bg-green-50 text-[var(--color-success-700)]",
        neutral:
          "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]",
      },
    },
    defaultVariants: {
      status: "neutral",
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    showDot?: boolean;
  };

export function Badge({
  className,
  status,
  showDot = true,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ status }), className)} {...props}>
      {showDot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
