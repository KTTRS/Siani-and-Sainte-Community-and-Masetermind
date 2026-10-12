import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "of-skeleton rounded-[6px] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
