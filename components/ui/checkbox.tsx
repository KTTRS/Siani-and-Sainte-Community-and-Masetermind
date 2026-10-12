import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "of-well of-control-press peer h-4 w-4 shrink-0 rounded-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--mint-300))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:[background:linear-gradient(180deg,hsl(var(--mint-300))_0%,hsl(var(--mint-500))_100%)] data-[state=checked]:[box-shadow:inset_0_1.5px_0_rgba(255,255,255,0.55),inset_0_-1.5px_0_rgba(0,0,0,0.3),0_1px_0_rgba(0,0,0,0.45),0_3px_6px_-1px_rgba(0,0,0,0.5)] data-[state=checked]:text-[hsl(var(--everglade-950))]",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
