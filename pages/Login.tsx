import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '@/lib/haptics';
import { prefersReducedMotion } from '@/lib/motion';
import '@/styles/organic-futurism.css';
import sianiPortraitUrl from '@assets/siani-portrait_1764187902757.jpg';
import sainteLogoUrl from '@assets/2025-01_-_Logo_Midnight_2x_-_Current_1778265222384.png';
import sianiLogoUrl from '@assets/Siani._-_2_1778265466702.png';

export default function Login() {
  const [, setLocation] = useLocation();
  const { signIn, isLoading } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const reduced = prefersReducedMotion();
  // Cinematic, weighted tween — never bouncy. Reduced-motion ⇒ instant.
  const sheetIn = reduced
    ? { duration: 0 }
    : { duration: 0.56, ease: [0.22, 1, 0.36, 1] as const };
  const scrimIn = reduced
    ? { duration: 0 }
    : { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Both fields required');
      haptic('warn');
      return;
    }
    setError(null);
    haptic('click');
    try {
      await signIn(email.trim(), password);
      haptic('success');
      toast({ title: 'Welcome back' });
      setLocation('/');
    } catch (err: any) {
      haptic('warn');
      setError(err.message || 'Could not sign in');
    }
  };

  return (
    <div className="of-root" data-testid="login-organic-futurism">
      <div className="of-void" />

      <div className="of-screen">
        <div className="of-meta">
          <span><span className="of-meta-dot" />Detroit · 42.331° N</span>
          <span>Vol. 04</span>
        </div>

        <div className="of-mast">
          <p className="of-eyebrow">
            <span>Members Network</span>
            <span>Est. 2025</span>
          </p>

          <h1
            className="of-hero-siani"
            role="img"
            aria-label="Siani"
            style={{
              WebkitMaskImage: `url(${sianiLogoUrl})`,
              maskImage: `url(${sianiLogoUrl})`,
            }}
          />

          <div className="of-orb-bay" aria-hidden>
            <div className="of-orb-room" />
            <div className="of-orb-halo" />
            <div className="of-orb">
              <div
                className="of-orb-portrait"
                style={{ backgroundImage: `url(${sianiPortraitUrl})` }}
              />
              <div className="of-orb-glass" />
            </div>
            <div className="of-orb-floor" />
            <p className="of-orb-cap">
              <span className="of-siani-meta">LISTENING</span>
            </p>
          </div>
        </div>

        <div className="of-cta-row">
          <button
            type="button"
            className="of-btn gel"
            onClick={() => { haptic('rise'); setOpen(true); }}
            data-testid="button-open-signin"
          >
            Enter
          </button>
          <Link href="/request-invite">
            <button type="button" className="of-btn ghost" data-testid="link-request-invite">
              Request invitation
            </button>
          </Link>
        </div>

        <div className="of-foot">
          <span>No. 0481 / 1000</span>
          <span className="of-foot-powered">
            <span className="of-foot-powered-label">Powered by</span>
            <img src={sainteLogoUrl} alt="Sainte Labs" className="of-foot-sainte" />
          </span>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="of-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={scrimIn}
              onClick={() => { haptic('soft'); setOpen(false); }}
            />
            <motion.div
              className="of-sheet"
              initial={{ y: reduced ? 0 : '110%', opacity: reduced ? 1 : 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: reduced ? 0 : '110%', opacity: reduced ? 1 : 0.6 }}
              transition={sheetIn}
              data-testid="sheet-signin"
            >
              <div className="of-sheet-handle" aria-hidden />
              <div className="of-sheet-eyebrow">
                <span>Sign in</span>
                <button
                  type="button"
                  className="of-sheet-close"
                  onClick={() => { haptic('soft'); setOpen(false); }}
                  aria-label="Close"
                  data-testid="button-close-signin"
                >×</button>
              </div>

              <h2 className="of-sheet-title">Welcome back.</h2>

              <form onSubmit={handleSubmit} className="of-form">
                {error && <div className="of-err" data-testid="text-login-error">{error}</div>}

                <label className="of-field">
                  <span className="of-field-label">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="of-input"
                    placeholder="you@somewhere"
                    data-testid="input-email"
                  />
                </label>

                <label className="of-field">
                  <span className="of-field-label">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="of-input"
                    placeholder="••••••••"
                    data-testid="input-password"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="of-btn gel"
                  data-testid="button-login"
                  style={{ marginTop: 8 }}
                >
                  {isLoading ? 'Opening…' : 'Enter'}
                </button>

                <div className="of-sheet-foot">
                  <Link href="/forgot-password">
                    <a data-testid="link-forgot-password">Forgot password</a>
                  </Link>
                  <Link href="/request-invite">
                    <a data-testid="link-request-invite-sheet">Request invitation</a>
                  </Link>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
