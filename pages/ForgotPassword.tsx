import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '@/lib/haptics';
import '@/styles/direction-d.css';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const t = setInterval(() => setNow(formatClock(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('OP-EMAIL REQUIRED');
      haptic('warn');
      return;
    }
    setError(null);
    setIsLoading(true);
    haptic('click');
    try {
      await resetPassword(email.trim());
      haptic('success');
      setSuccess(true);
      toast({ title: 'RESET DISPATCHED', description: 'Check your inbox for the recovery link.' });
    } catch (err: any) {
      haptic('warn');
      setError((err.message || 'TRANSMISSION FAILED').toUpperCase());
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="dir-d-root" data-testid="forgot-success-direction-d">
        <div className="d-screen d-login">
          <div className="d-status">
            <span>{now}</span>
            <span className="d-status-c">RST-OK</span>
            <span className="d-status-sig">● SENT</span>
          </div>
          <div className="d-grid-bg" />
          <div className="d-login-mast">
            <div className="d-spec-row">
              <span className="d-spec"><i>VOL</i><b>04</b></span>
              <span className="d-spec"><i>STA</i><b>SENT</b></span>
              <span className="d-spec"><i>REV</i><b>A.0</b></span>
            </div>
            <h1 className="d-display">RECOVERY<br />DISPATCHED.</h1>
            <div className="d-rule signal" />
            <p className="d-mono-cap">RESET LINK · {email.toUpperCase()}</p>
          </div>
          <div className="d-login-panel">
            <div className="d-panel-head">
              <span className="d-panel-code">RST.OK</span>
              <span className="d-panel-title">DISPATCHED</span>
              <span className="d-panel-corner" />
            </div>
            <div className="d-data-row">
              <span>CHANNEL</span>
              <span className="d-data-val ok">● EMAIL</span>
            </div>
            <div className="d-data-row">
              <span>WINDOW</span>
              <span className="d-data-val">60 MIN</span>
            </div>
            <Link href="/login">
              <button type="button" className="d-btn signal" data-testid="button-back-to-login">
                RETURN TO ACCESS ▸
              </button>
            </Link>
          </div>
          <div className="d-foot">
            <span>SN.RST.OK.A</span>
            <span className="d-foot-sig">● ENCRYPTED</span>
            <span>{now}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dir-d-root" data-testid="forgot-direction-d">
      <div className="d-screen d-login">
        <div className="d-status">
          <span>{now}</span>
          <span className="d-status-c">RST-01</span>
          <span className="d-status-sig">● ENC</span>
        </div>

        <div className="d-grid-bg" />

        <div className="d-login-mast">
          <div className="d-spec-row">
            <span className="d-spec"><i>VOL</i><b>04</b></span>
            <span className="d-spec"><i>OP</i><b>RECOVERY</b></span>
            <span className="d-spec"><i>REV</i><b>A.0</b></span>
          </div>
          <h1 className="d-display">RESET<br />OP-CODE.</h1>
          <div className="d-rule signal" />
          <p className="d-mono-cap">SECURE RECOVERY · ENCRYPTED CHANNEL</p>
        </div>

        <div className="d-login-panel">
          <div className="d-panel-head">
            <span className="d-panel-code">RST.01</span>
            <span className="d-panel-title">RECOVER</span>
            <span className="d-panel-corner" />
          </div>
          <div className="d-data-row">
            <span>CHANNEL</span>
            <span className="d-data-val ok">● EMAIL</span>
          </div>
          <div className="d-data-row">
            <span>METHOD</span>
            <span className="d-data-val">ONE-TIME LINK</span>
          </div>
          <button
            type="button"
            className="d-btn primary"
            onClick={() => { haptic('rise'); setOpen(true); }}
            data-testid="button-open-reset"
          >
            REQUEST RESET LINK
          </button>
          <Link href="/login">
            <button type="button" className="d-btn ghost" data-testid="link-back">
              ◂ RETURN TO ACCESS
            </button>
          </Link>
        </div>

        <div className="d-foot">
          <span>SN.RST.0001.A</span>
          <span className="d-foot-sig">● ENCRYPTED</span>
          <span>{now}</span>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="d-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: 'linear' }}
              onClick={() => { haptic('soft'); setOpen(false); }}
            />
            <motion.div
              className="d-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              data-testid="sheet-reset"
            >
              <div className="d-sheet-handle" aria-hidden />
              <div className="d-sheet-eyebrow">
                <span>● RST.01 / RECOVERY</span>
                <button
                  type="button"
                  className="d-sheet-close"
                  onClick={() => { haptic('soft'); setOpen(false); }}
                  aria-label="Close"
                  data-testid="button-close-reset"
                >×</button>
              </div>

              <h2 className="d-sheet-title">CONFIRM<br />OP-EMAIL.</h2>

              <form onSubmit={handleSubmit} className="d-form">
                {error && <div className="d-err" data-testid="text-reset-error">{error}</div>}

                <label className="d-field">
                  <span className="d-field-label">OP-EMAIL</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="d-input"
                    placeholder="OPERATOR@SAINTE"
                    data-testid="input-email"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="d-btn signal"
                  data-testid="button-reset"
                  style={{ width: '100%', margin: '4px 0 0' }}
                >
                  {isLoading ? 'TRANSMITTING…' : 'TRANSMIT ▸'}
                </button>

                <div className="d-sheet-foot">
                  <Link href="/login">
                    <a data-testid="link-login-sheet">RETURN TO ACCESS</a>
                  </Link>
                  <Link href="/request-invite">
                    <a data-testid="link-request-invite-sheet">REQUEST CLEARANCE</a>
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

function formatClock(d: Date) {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
