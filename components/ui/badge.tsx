import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Whitespace-nowrap: Badges should never wrap.
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" +
  " hover-elevate " ,
  {
    variants: {
      variant: {
        default:
          "of-chip border-transparent text-[hsl(var(--hi))]",
        secondary: "border-[hsl(var(--rim))] bg-[hsl(var(--surface-2))] text-[hsl(var(--hi))] shadow-[inset_0_1.5px_0_rgba(231,255,232,0.14),inset_0_-1.5px_0_rgba(0,0,0,0.5),0_1px_0_rgba(0,0,0,0.4),0_3px_6px_-1px_rgba(0,0,0,0.5)]",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.4),0_2px_4px_-1px_rgba(0,0,0,0.45)]",

        outline: " border [border-color:var(--badge-outline)] shadow-[inset_0_1px_0_rgba(231,255,232,0.06),0_1px_2px_rgba(0,0,0,0.3)]",
        // Direction D — Tactical Mil-Spec. 2px radius, hairline rim,
        // mono label type. Use `signal` only for the single accent per screen.
        hud: "rounded-d border border-rim bg-surface-2 text-mid font-label uppercase tracking-[0.32em] text-[10px] px-d-sm py-[2px]",
        signal: "rounded-d border-transparent bg-signal text-bg font-label uppercase tracking-[0.32em] text-[10px] px-d-sm py-[2px] shadow-d-signal",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
