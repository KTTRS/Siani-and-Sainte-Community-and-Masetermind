import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-lg text-sm font-semibold tracking-wide focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--rim-bright))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-all duration-[180ms] ease-[cubic-bezier(0.2,0,0.2,1)]",
  {
    variants: {
      variant: {
          default:
          "of-press-deep button-3d text-white",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border shadow-dramatic",
        outline:
          "of-press border-2 border-white/20 bg-charcoal text-white shadow-dramatic hover:bg-smoke hover:border-white/30",
        secondary: "of-press of-press-deep button-3d-secondary text-white",
        ghost: "of-press of-control-press border border-transparent text-silver hover:text-white hover:bg-white/10",
        glass: "of-press of-press-deep btn-glass text-white",
        // Direction D — Tactical Mil-Spec variants. 2px radius, hairline rim,
        // 80ms tap, no bounce. `signal` = the accent CTA (one per screen).
        // `metallic` = primary surface action. `hud` = HUD-style ghost.
        signal:
          "of-press of-press-deep of-sheen-top rounded-d bg-mint-300 text-everglade-950 hover:bg-mint-200 transition-all duration-d-tap ease-d-precision shadow-[inset_0_1.5px_0_rgba(255,255,255,0.55),inset_0_-1.5px_0_rgba(0,0,0,0.18),0_2px_0_rgba(0,0,0,0.22),0_8px_18px_-6px_rgba(0,0,0,0.5),0_16px_28px_-12px_rgba(0,0,0,0.4)]",
        metallic:
          "of-press of-press-deep of-tier-1 rounded-d text-hi transition-all duration-d-tap ease-d-precision",
        hud:
          "of-press rounded-d bg-transparent text-hi border border-rim hover:border-rim-bright hover:bg-surface/60 transition-colors duration-d-tap ease-d-precision",
      },
      size: {
        default: "min-h-11 px-6 py-2.5",
        sm: "min-h-8 rounded-md px-4 text-xs",
        lg: "min-h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
