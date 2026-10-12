import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "of-control-press inline-flex items-center justify-center rounded-md text-sm font-medium transition-[background,box-shadow,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--mint-300))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] disabled:pointer-events-none disabled:opacity-50 text-[hsl(var(--mid))] data-[state=on]:bg-[hsl(var(--surface-2))] data-[state=on]:text-[hsl(var(--hi))] data-[state=on]:shadow-[inset_0_1px_0_rgba(231,255,232,0.10),inset_0_-1px_0_rgba(0,0,0,0.45),0_1px_0_rgba(0,0,0,0.4),0_4px_8px_-2px_rgba(0,0,0,0.5)] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 gap-2",
  {
    variants: {
      variant: {
        default: "bg-transparent hover-elevate",
        outline:
          "border border-[hsl(var(--rim))] bg-transparent hover-elevate",
      },
      size: {
        default: "h-10 px-3 min-w-10",
        sm: "h-9 px-2.5 min-w-9",
        lg: "h-11 px-5 min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
