type Pattern = "tap" | "soft" | "click" | "success" | "warn" | "rise";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  soft: 4,
  click: 12,
  success: [8, 30, 14],
  warn: [12, 40, 12, 40, 12],
  rise: [4, 18, 8, 18, 12],
};

function reducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function haptic(p: Pattern = "tap") {
  if (typeof navigator === "undefined") return;
  if (reducedMotion()) return;
  const v = (navigator as any).vibrate?.bind(navigator);
  if (!v) return;
  try { v(PATTERNS[p]); } catch {}
}

// Backward-compatible aliases used by older pages.
// Map legacy intensity names onto the new semantic patterns.
export const hapticLight = () => haptic("tap");
export const hapticMedium = () => haptic("click");
export const hapticImpact = () => haptic("click");
export const hapticSuccess = () => haptic("success");
export const hapticWarn = () => haptic("warn");
export const hapticRise = () => haptic("rise");
