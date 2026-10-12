import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "shadcn-card of-resin of-card-lift rounded-2xl text-card-foreground",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card"

/**
 * Direction D — Tactical Mil-Spec card surface. 2px radius, surface-2 fill,
 * hairline rim, optional grain. Use on every new screen built against the
 * mil-spec direction. Variants: `panel` (L1), `hud` (L2 inset hairline),
 * `metal` (L3 raised neomorphism), `modal` (L4).
 */
const CardD = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "panel" | "hud" | "metal" | "modal";
    grain?: boolean;
  }
>(({ className, variant = "panel", grain = false, ...props }, ref) => {
  const variantClass = {
    panel: "d-L1",
    hud: "d-L2",
    metal: "d-L3",
    modal: "d-L4",
  }[variant];
  return (
    <div
      ref={ref}
      className={cn(
        variantClass,
        "text-hi p-d-lg",
        grain && "d-grain",
        className,
      )}
      {...props}
    />
  );
});
CardD.displayName = "CardD"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"
export {
  Card,
  CardD,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
