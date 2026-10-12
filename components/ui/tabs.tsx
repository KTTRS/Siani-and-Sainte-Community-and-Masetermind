import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-lg bg-[hsl(var(--surface))] border border-[hsl(var(--rim))] p-1 text-[hsl(var(--mid))] shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(0,0,0,0.35),0_1px_0_rgba(231,255,232,0.04)]",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-[180ms] ease-[cubic-bezier(0.2,0,0.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--mint-300))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[hsl(var(--surface-2))] data-[state=active]:text-[hsl(var(--hi))] data-[state=active]:shadow-[inset_0_1px_0_rgba(231,255,232,0.10),inset_0_-1px_0_rgba(0,0,0,0.45),0_1px_0_rgba(0,0,0,0.4),0_4px_8px_-2px_rgba(0,0,0,0.5)]",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

/* Direction D variants — HUD strip, signal underline on active. */
const TabsListD = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-11 items-center justify-start gap-0",
      "bg-[hsl(var(--surface))] rounded-[2px] p-0 border border-[hsl(var(--rim))]",
      className,
    )}
    {...props}
  />
))
TabsListD.displayName = "TabsListD"

const TabsTriggerD = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap min-h-[44px] px-4",
      "font-[var(--font-label)] text-[10px] tracking-[0.32em] uppercase text-[hsl(var(--mid))]",
      "transition-colors duration-[80ms] ease-linear",
      "focus-visible:outline-none focus-visible:text-[hsl(var(--hi))]",
      "data-[state=active]:text-[hsl(var(--hi))]",
      "data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-[hsl(var(--signal))]",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
))
TabsTriggerD.displayName = "TabsTriggerD"

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsListD, TabsTriggerD }
