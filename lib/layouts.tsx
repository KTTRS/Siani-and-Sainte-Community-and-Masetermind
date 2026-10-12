import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

interface BentoItemProps {
  children: React.ReactNode;
  className?: string;
  span?: "1" | "2" | "full";
  height?: "sm" | "md" | "lg";
}

export function BentoItem({ children, className, span = "1", height = "md" }: BentoItemProps) {
  const spanClass = {
    "1": "col-span-1",
    "2": "col-span-2",
    "full": "col-span-full",
  }[span];

  const heightClass = {
    sm: "min-h-[120px]",
    md: "min-h-[180px]",
    lg: "min-h-[280px]",
  }[height];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(spanClass, heightClass, className)}
    >
      {children}
    </motion.div>
  );
}

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: 2 | 3 | 4;
}

export function BentoGrid({ children, className, cols = 2 }: BentoGridProps) {
  const colsClass = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  }[cols];

  return (
    <div className={cn("grid gap-3", colsClass, className)}>
      {children}
    </div>
  );
}

interface HeroFeatureProps {
  children: React.ReactNode;
  satellite?: React.ReactNode;
  className?: string;
}

export function HeroFeature({ children, satellite, className }: HeroFeatureProps) {
  return (
    <div className={cn("relative", className)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10"
      >
        {children}
      </motion.div>
      {satellite && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute -right-4 -bottom-4 z-0"
        >
          {satellite}
        </motion.div>
      )}
    </div>
  );
}

interface CarouselProps {
  children: React.ReactNode[];
  className?: string;
  itemClassName?: string;
  showArrows?: boolean;
  snapToItem?: boolean;
}

export function HorizontalCarousel({ 
  children, 
  className, 
  itemClassName,
  showArrows = true,
  snapToItem = true 
}: CarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      return () => el.removeEventListener("scroll", checkScroll);
    }
  }, [children]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    hapticLight();
    const itemWidth = scrollRef.current.firstElementChild?.clientWidth || 300;
    const scrollAmount = direction === "left" ? -itemWidth : itemWidth;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  return (
    <div className={cn("relative group", className)}>
      {showArrows && canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-charcoal/90 border border-smoke/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          data-testid="carousel-scroll-left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mb-2",
          snapToItem && "snap-x snap-mandatory"
        )}
      >
        {children.map((child, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "flex-shrink-0",
              snapToItem && "snap-start",
              itemClassName
            )}
          >
            {child}
          </motion.div>
        ))}
      </div>

      {showArrows && canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-charcoal/90 border border-smoke/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          data-testid="carousel-scroll-right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

interface MagazineCardProps {
  image: string;
  overline?: string;
  headline: string;
  deck?: string;
  size?: "sm" | "md" | "lg" | "hero";
  onClick?: () => void;
  className?: string;
  overlay?: "dark" | "gradient" | "none";
}

export function MagazineCard({
  image,
  overline,
  headline,
  deck,
  size = "md",
  onClick,
  className,
  overlay = "gradient"
}: MagazineCardProps) {
  const sizeClasses = {
    sm: "h-48",
    md: "h-64",
    lg: "h-80",
    hero: "h-[400px]",
  }[size];

  const textSizes = {
    sm: { headline: "text-lg", deck: "text-xs" },
    md: { headline: "text-xl", deck: "text-sm" },
    lg: { headline: "text-2xl", deck: "text-base" },
    hero: { headline: "text-3xl md:text-4xl", deck: "text-lg" },
  }[size];

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={() => {
        hapticLight();
        onClick?.();
      }}
      className={cn(
        "relative cursor-pointer group matte-floating overflow-hidden",
        sizeClasses,
        className
      )}
      data-testid="magazine-card"
    >
      <img
        src={image}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      
      {overlay === "gradient" && (
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      )}
      {overlay === "dark" && (
        <div className="absolute inset-0 bg-everglade-950/70" />
      )}

      <div className="absolute inset-0 p-5 flex flex-col justify-end z-10">
        {overline && (
          <span className="font-condensed text-[10px] tracking-[0.2em] text-crimson mb-2">
            {overline}
          </span>
        )}
        <h3 className={cn("font-display text-white leading-tight mb-1", textSizes.headline)}>
          {headline}
        </h3>
        {deck && (
          <p className={cn("text-silver line-clamp-2", textSizes.deck)}>
            {deck}
          </p>
        )}
      </div>
    </motion.div>
  );
}

interface Clay3DCardProps {
  children: React.ReactNode;
  variant?: "default" | "crimson" | "floating";
  className?: string;
  onClick?: () => void;
}

export function Clay3DCard({ children, variant = "default", className, onClick }: Clay3DCardProps) {
  const variantClass = {
    default: "matte-3d",
    crimson: "matte-3d-crimson",
    floating: "matte-floating",
  }[variant];

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={() => {
        if (onClick) {
          hapticLight();
          onClick();
        }
      }}
      className={cn(variantClass, "p-5", onClick && "cursor-pointer", className)}
    >
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}

interface StackedCardsProps {
  items: { id: string; content: React.ReactNode }[];
  className?: string;
}

export function StackedCards({ items, className }: StackedCardsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className={cn("relative h-[300px]", className)}>
      {items.map((item, i) => {
        const offset = i - activeIndex;
        const isActive = i === activeIndex;
        
        return (
          <motion.div
            key={item.id}
            animate={{
              scale: isActive ? 1 : 0.9 - Math.abs(offset) * 0.05,
              y: offset * 15,
              opacity: Math.abs(offset) > 2 ? 0 : 1 - Math.abs(offset) * 0.2,
              zIndex: items.length - Math.abs(offset),
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={() => {
              hapticLight();
              setActiveIndex(i);
            }}
            className={cn(
              "absolute inset-x-0 cursor-pointer",
              !isActive && "pointer-events-auto"
            )}
          >
            {item.content}
          </motion.div>
        );
      })}
    </div>
  );
}

interface StatRingProps {
  value: number;
  max: number;
  label: string;
  size?: "sm" | "md" | "lg";
  color?: string;
}

export function StatRing({ value, max, label, size = "md", color = "crimson" }: StatRingProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = size === "sm" ? 28 : size === "md" ? 40 : 56;
  const strokeWidth = size === "sm" ? 4 : size === "md" ? 6 : 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: radius * 2 + strokeWidth, height: radius * 2 + strokeWidth }}>
        <svg className="transform -rotate-90" width="100%" height="100%">
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-smoke/30"
          />
          <motion.circle
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className={`text-${color}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className={cn(
              "font-stats tabular-nums text-white",
              size === "sm" ? "text-lg" : size === "md" ? "text-2xl" : "text-3xl"
            )}
          >
            {value}
          </motion.span>
        </div>
      </div>
      <span className="font-condensed text-[10px] tracking-[0.15em] text-silver uppercase">
        {label}
      </span>
    </div>
  );
}

interface GlowBadgeProps {
  children: React.ReactNode;
  variant?: "crimson" | "gold" | "silver";
  pulse?: boolean;
}

export function GlowBadge({ children, variant = "crimson", pulse = false }: GlowBadgeProps) {
  const colors = {
    crimson: "bg-crimson/20 text-crimson border-crimson/40",
    gold: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    silver: "bg-silver/20 text-silver border-silver/40",
  }[variant];

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-condensed tracking-[0.15em] uppercase border",
      colors,
      pulse && "animate-pulse"
    )}>
      {children}
    </span>
  );
}
