import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "of-well of-control-press peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-[background] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--mint-300))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "of-cap pointer-events-none block h-5 w-5 rounded-full ring-0 transition-transform duration-[180ms] ease-[cubic-bezier(0.2,0,0.2,1)] data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 data-[state=checked]:[background:linear-gradient(180deg,hsl(var(--mint-300))_0%,hsl(var(--mint-500))_100%)]"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
