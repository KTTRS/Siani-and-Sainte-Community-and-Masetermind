import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLocation } from "wouter";
import { useHapticFeedback } from "@/hooks/useNativeShell";
import { haptic } from "@/lib/haptics";
import { X } from "lucide-react";
import { Icon3DImage, Icons3D } from "@/lib/icons3d";

type NavIconKey = keyof typeof Icons3D;
type NavItem = { path: string; iconKey: NavIconKey; label: string; primary?: boolean };

// Main navigation items. `primary` = SIANI orb tile, gets the mint-gel halo
// rather than a fill change so the lime accent never appears in chrome.
const MAIN_NAV_ITEMS: NavItem[] = [
  { path: "/", iconKey: "brain", label: "SIANI", primary: true },
  { path: "/flow", iconKey: "sparkles", label: "FLOW" },
  { path: "/hq", iconKey: "crown", label: "HQ" },
  { path: "/bag", iconKey: "package", label: "BAG" },
  { path: "/profile", iconKey: "user", label: "YOU" },
];

const NIGHT_SHIFT_ITEMS: NavItem[] = [
  { path: "/drop", iconKey: "drop", label: "DROP" },
  { path: "/signal", iconKey: "signal", label: "SIGNAL" },
  { path: "/vault", iconKey: "vault", label: "VAULT" },
  { path: "/heat", iconKey: "podium", label: "HEAT" },
  { path: "/mastermind", iconKey: "globe", label: "ORBIT" },
];

export function CornerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { vibrate } = useHapticFeedback();
  const reduceMotion = useReducedMotion();
  const pillTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 32 };

  const handleToggle = useCallback(() => {
    vibrate('light');
    haptic(isOpen ? 'tap' : 'rise');
    setIsOpen(prev => !prev);
  }, [vibrate, isOpen]);

  const handleNavClick = useCallback((path: string) => {
    vibrate('light');
    haptic('click');
    setIsOpen(false);
    navigate(path);
    setTimeout(() => {
      if (window.location.pathname !== path) {
        window.location.href = path;
      }
    }, 150);
  }, [navigate, vibrate]);

  // Tile renderer — matte everglade base, mint-300 hairline rim on active,
  // SVG glyph centered, fog label below. No lime, no glow on chrome.
  const renderTile = (item: NavItem, opts: { compact?: boolean; idx: number; baseDelay: number }) => {
    const { compact = false, idx, baseDelay } = opts;
    const isActive = location === item.path;
    const isPrimary = !!item.primary;
    const tileSize = compact ? 'w-9 h-9' : 'w-11 h-11';
    const iconSize = compact ? 22 : 26;
    const labelSize = compact ? 'text-[8px]' : 'text-[9px]';

    return (
      <motion.button
        key={item.path}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: baseDelay + idx * 0.04, type: "spring", stiffness: 380, damping: 26 }}
        onClick={() => handleNavClick(item.path)}
        className="qm-tab flex flex-col items-center gap-1.5 p-3 rounded-xl active:scale-95"
        style={{
          backgroundColor: 'transparent',
          border: '1px solid transparent',
          transition: 'transform 160ms ease-out',
        }}
        data-testid={`nav-${item.path.replace('/', '') || 'home'}`}
      >
        <div
          className={`${tileSize} rounded-xl flex items-center justify-center relative`}
          style={{
            background: isPrimary
              ? 'radial-gradient(circle at 30% 25%, hsl(var(--everglade-600)) 0%, hsl(var(--everglade-800)) 60%, hsl(var(--everglade-950)) 100%)'
              : isActive
                ? 'linear-gradient(145deg, hsl(var(--everglade-700)) 0%, hsl(var(--everglade-900)) 100%)'
                : 'linear-gradient(145deg, hsl(var(--everglade-800)) 0%, hsl(var(--everglade-950)) 100%)',
            boxShadow: isActive || isPrimary
              ? 'inset 0 1px 0 rgba(230,255,232,0.14), inset 0 -1px 0 rgba(0,0,0,0.55), 0 4px 14px rgba(0,0,0,0.55)'
              : 'inset 0 1px 0 rgba(230,255,232,0.06), inset 0 -1px 0 rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.4)',
            border: isActive
              ? '1px solid hsl(var(--mint-300) / 0.32)'
              : '1px solid hsl(var(--rim))',
          }}
        >
          <Icon3DImage icon={item.iconKey} size={iconSize} />
        </div>
        <span
          className={`${labelSize} font-condensed tracking-[0.18em] uppercase`}
          style={{
            color: isActive
              ? 'hsl(var(--fog-100))'
              : isPrimary
                ? 'hsl(var(--mint-200))'
                : 'hsl(var(--lo))',
          }}
        >
          {item.label}
        </span>
        {isActive && !compact && (
          <motion.span
            layoutId="qm-active-pill"
            className="qm-tab-bar"
            aria-hidden
            transition={pillTransition}
          />
        )}
      </motion.button>
    );
  };

  return (
    <>
      {/* Backdrop — everglade-950 wash, no pure black */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100]"
            style={{
              backgroundColor: 'hsl(var(--everglade-950) / 0.85)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Menu Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed z-[150] left-4 right-4"
            style={{ bottom: 'max(100px, calc(env(safe-area-inset-bottom, 20px) + 80px))' }}
          >
            {/* Main Navigation — matte resin card */}
            <div className="matte-3d rounded-2xl p-4 mb-3">
              <div
                className="text-[10px] font-condensed tracking-[0.22em] uppercase mb-3 px-1"
                style={{ color: 'hsl(var(--lo))' }}
              >
                NAVIGATE
              </div>
              <div className="grid grid-cols-5 gap-2">
                {MAIN_NAV_ITEMS.map((item, i) =>
                  renderTile(item, { idx: i, baseDelay: 0.05 }),
                )}
              </div>
            </div>

            {/* Night Shift Section — deeper everglade ground, mint-300 dot */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: 'linear-gradient(145deg, hsl(var(--everglade-950)) 0%, hsl(var(--everglade-900)) 100%)',
                border: '1px solid hsl(var(--rim))',
                boxShadow: '0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(230,255,232,0.06)',
              }}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: 'hsl(var(--mint-300))' }}
                />
                <span
                  className="text-[10px] font-condensed tracking-[0.22em] uppercase"
                  style={{ color: 'hsl(var(--mint-200))' }}
                >
                  «NIGHT SHIFT»
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {NIGHT_SHIFT_ITEMS.map((item, i) =>
                  renderTile(item, { idx: i, baseDelay: 0.18, compact: true }),
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle FAB — matte everglade, mint-300 hairline when open. No lime. */}
      <motion.button
        onClick={handleToggle}
        className="fixed z-[200] flex items-center justify-center cursor-pointer"
        style={{
          right: 'max(20px, env(safe-area-inset-right, 20px))',
          bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: isOpen
            ? 'radial-gradient(circle at 30% 25%, hsl(var(--everglade-600)) 0%, hsl(var(--everglade-800)) 60%, hsl(var(--everglade-950)) 100%)'
            : 'radial-gradient(circle at 30% 25%, hsl(var(--everglade-700)) 0%, hsl(var(--everglade-900)) 70%, hsl(var(--everglade-950)) 100%)',
          boxShadow: isOpen
            ? 'inset 0 2px 0 rgba(230,255,232,0.14), inset 0 -2px 0 rgba(0,0,0,0.65), 0 8px 28px rgba(0,0,0,0.7)'
            : 'inset 0 2px 0 rgba(230,255,232,0.08), inset 0 -2px 0 rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.6)',
          border: isOpen
            ? '1px solid hsl(var(--mint-300) / 0.32)'
            : '1px solid hsl(var(--rim))',
        }}
        whileTap={{ scale: 0.92 }}
        data-testid="button-menu-toggle"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-7 h-7" style={{ color: 'hsl(var(--fog-100))' }} />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center gap-1"
            >
              {[0, 1, 2].map((row) => (
                <div className="flex gap-1" key={row}>
                  {[0, 1, 2].map((col) => (
                    <span
                      key={col}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          row === 1 && col === 1
                            ? 'hsl(var(--mint-300))'
                            : 'hsl(var(--fog-100) / 0.55)',
                      }}
                    />
                  ))}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
