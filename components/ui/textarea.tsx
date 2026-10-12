import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "of-fog-input flex min-h-[80px] w-full px-3 py-2 text-base text-[hsl(var(--hi))] placeholder:text-[hsl(var(--lo))] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

/**
 * Direction D textarea — graphite surface, hairline rim, 2px radius, signal
 * focus. Min-height 88px so the tap target is never under the 44px minimum
 * even on the first row.
 */
const TextareaD = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[88px] w-full px-3 py-2 text-[13px] leading-[1.45]",
      "bg-[hsl(var(--surface))] text-[hsl(var(--hi))] placeholder:text-[hsl(var(--lo))]",
      "rounded-[2px] border border-[hsl(var(--rim))]",
      "focus-visible:outline-none focus-visible:border-[hsl(var(--signal))] focus-visible:shadow-[0_0_0_1px_hsl(var(--signal))]",
      "transition-colors duration-[120ms] ease-linear",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "font-[var(--font-body)]",
      className,
    )}
    {...props}
  />
))
TextareaD.displayName = "TextareaD"

export { Textarea, TextareaD }
