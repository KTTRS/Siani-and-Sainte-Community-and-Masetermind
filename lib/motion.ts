export const EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
  // Direction D — linear/precision. No bounce on layout.
  linear: [0, 0, 1, 1] as const,
  precision: [0.2, 0.0, 0.2, 1] as const,
};

export const DURATION = {
  fast: 0.18,
  base: 0.32,
  slow: 0.52,
  page: 0.45,
  // Direction D cadence
  tap: 0.08,
  nudge: 0.12,
  reveal: 0.24,
  pageD: 0.24,
  pulse: 1.6,
  orbit: 14,
};

export const SPRING = {
  sheet: { type: "spring" as const, stiffness: 320, damping: 32 },
  pop:   { type: "spring" as const, stiffness: 420, damping: 24 },
  soft:  { type: "spring" as const, stiffness: 220, damping: 28 },
  // Direction D — commit. Tighter, no overshoot.
  commit: { type: "spring" as const, stiffness: 280, damping: 26 },
};

export const STAGGER = {
  list: 0.04,
  hero: 0.08,
};

/**
 * Direction D — Tactical Mil-Spec motion tokens. Use these on every new
 * surface so the whole product breathes with one cadence. Linear easings,
 * tight durations, no bounce on layout. Orb is the only object that breathes.
 */
export const MILSPEC = {
  ease: { linear: EASE.linear, precision: EASE.precision },
  dur: {
    tap: 0.08,
    nudge: 0.12,
    commit: 0.28,    // spring 280/26 — see SPRING.commit
    reveal: 0.24,
    page: 0.24,
    pulse: 1.6,
    orbit: 14,
  },
  /** Page transition — 240ms linear cross-fade. */
  page: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.24, ease: EASE.linear } },
} as const;

/**
 * Paced-rhythm helper — multi-step flows share one cadence. Returns a
 * staggered transition for a step at index `i` so onboarding, signal
 * acknowledgement, drop reveal, etc. all use identical pacing.
 */
export function pacedRhythm(i: number, base: number = 0.06) {
  if (prefersReducedMotion()) return { duration: 0, delay: 0 };
  return { duration: DURATION.reveal, delay: i * base, ease: EASE.precision };
}

/**
 * T119 — Onboarding crescendo. Shared step-to-step transition tokens so
 * every onboarding screen breathes with the same rhythm: hero clay lands
 * first, headline second, body third, CTA last. Reduced-motion is handled
 * at the consumer site (delays still apply but durations collapse to 0).
 */
export const STEP = {
  enter:    { y: 32,  opacity: 0 },
  center:   { y: 0,   opacity: 1 },
  exit:     { y: -24, opacity: 0 },
  spring:   SPRING.sheet,
  // Sequenced reveal delays (seconds) — hero → headline → body → cta.
  delay: {
    hero:     STAGGER.hero,        // 0.08
    headline: STAGGER.hero * 2,    // 0.16
    body:     STAGGER.hero * 3,    // 0.24
    cta:      STAGGER.hero * 4,    // 0.32
  },
  duration: {
    headline: 0.45,
    body:     0.40,
    cta:      0.40,
  },
} as const;

/**
 * T119 — Wedge/seal reveal for the final onboarding step. A wax-seal
 * shape splits open into two wedges to expose the member's issue number.
 * Single coordinated haptic fires at `haptic` (seconds from mount).
 */
export const WEDGE = {
  flash:        { duration: 0.9,  ease: "easeOut" as const },
  sealHold:     0.35,                                          // disc visible before crack
  sealCrack:    { duration: 0.7,  ease: EASE.inOut },          // wedges rotate apart
  numberReveal: { delay: 0.95, duration: 0.9, ease: EASE.out },
  serialReveal: { delay: 1.40, duration: 0.5, ease: EASE.out },
  footerReveal: { delay: 1.60, duration: 0.5, ease: EASE.out },
  haptic:       0.95,                                          // matches numberReveal.delay
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
}

/**
 * Shared "fade-up reveal" transition. Use on `motion.div` / list items so
 * every screen breathes with the same duration + easing as Login + Home.
 * Honors prefers-reduced-motion (returns instant 0-duration object).
 */
export function fadeUp(delay = 0) {
  if (prefersReducedMotion()) return { duration: 0 };
  return { duration: DURATION.base, delay, ease: EASE.out };
}

/**
 * Shared "page reveal" transition for top-level page roots.
 */
export function pageReveal(delay = 0) {
  if (prefersReducedMotion()) return { duration: 0 };
  return { duration: DURATION.page, delay, ease: EASE.out };
}

/**
 * T100 — Shared card-flip reveal. Used by Drop + Signal cards so every
 * card surface settles with the same rotateY motion as the Home flip
 * overlay. Returns Framer Motion `initial` / `animate` / `transition`
 * triplet. Reduced-motion collapses to a 0-duration fade.
 */
export function flip(delay = 0) {
  if (prefersReducedMotion()) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0, delay: 0 },
      style: {} as Record<string, string | number>,
    };
  }
  return {
    initial: { opacity: 0, rotateY: 90 },
    animate: { opacity: 1, rotateY: 0 },
    transition: { duration: 0.38, delay, ease: EASE.out },
    style: {
      transformPerspective: 1200,
      transformStyle: "preserve-3d",
      backfaceVisibility: "hidden",
    } as Record<string, string | number>,
  };
}
