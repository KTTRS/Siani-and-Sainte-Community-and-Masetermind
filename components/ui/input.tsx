import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // h-9 to match icon buttons and default buttons.
    return (
      <input
        type={type}
        className={cn(
          "of-fog-input flex h-9 w-full px-3 py-2 text-base text-[hsl(var(--hi))] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[hsl(var(--lo))] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

/**
 * Direction D — Tactical Mil-Spec input. 44px tap target, 2px radius,
 * hairline rim, monospace value type, signal underline on focus.
 */
const InputD = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-d bg-surface text-hi placeholder:text-lo",
          "h-[44px] px-d-md py-d-sm font-numeric text-[14px]",
          "border border-rim focus-visible:outline-none focus-visible:border-signal focus-visible:shadow-d-signal",
          "transition-[border,box-shadow] duration-d-tap ease-d-precision",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
InputD.displayName = "InputD"

export { Input, InputD }
