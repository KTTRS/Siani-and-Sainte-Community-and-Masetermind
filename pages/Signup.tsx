import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '@/lib/haptics';
import '@/styles/direction-d.css';

const USER_TYPES = [
  { id: 'member', label: 'MEMBER' },
  { id: 'chw', label: 'COMMUNITY HEALTH WORKER' },
  { id: 'admin', label: 'ORGANIZATION ADMIN' },
];

export default function Signup() {
  const [, setLocation] = useLocation();
  const { signUp, isLoading } = useAuth();
  const { toast } = useToast();

  const [realName, setRealName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState('member');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState({
    shareConversations: false,
    shareLocation: false,
    allowNotifications: true,
    allowLeaderboard: true,
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [now, setNow] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const t = setInterval(() => setNow(formatClock(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  const validateStep1 = () => {
    if (!realName.trim() || !displayName.trim() || !zipCode.trim()) {
      setError('ALL FIELDS REQUIRED');
      haptic('warn');
      return false;
    }
    if (!/^\d{5}$/.test(zipCode.trim())) {
      setError('5-DIGIT ZIP REQUIRED');
      haptic('warn');
      return false;
    }
    setError(null);
    return true;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      haptic('click');
      setStep(2);
    }
  };

  const validateStep2 = () => {
    if (!email.trim() || !password.trim()) {
      setError('CREDENTIALS REQUIRED');
      haptic('warn');
      return false;
    }
    if (password !== confirmPassword) {
      setError('CODES DO NOT MATCH');
      haptic('warn');
      return false;
    }
    if (password.length < 6) {
      setError('CODE MUST BE 6+ CHARACTERS');
      haptic('warn');
      return false;
    }
    setError(null);
    return true;
  };

  const handleCredentialsNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep2()) {
      haptic('click');
      setStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('TERMS ACCEPTANCE REQUIRED');
      haptic('warn');
      return;
    }
    setError(null);
    haptic('click');
    try {
      await signUp(
        email.trim(),
        password,
        displayName.trim(),
        userType,
        realName.trim(),
        zipCode.trim(),
        consent,
        true,
      );
      haptic('success');
      setSuccess(true);
      toast({ title: 'CHECK YOUR EMAIL', description: 'Verify your account to continue.' });
    } catch (err: any) {
      haptic('warn');
      setError((err.message || 'REGISTRATION FAILED').toUpperCase());
    }
  };

  if (success) {
    return (
      <div className="dir-d-root" data-testid="signup-success-direction-d">
        <div className="d-screen d-login">
          <div className="d-status">
            <span>{now}</span>
            <span className="d-status-c">REG-OK</span>
            <span className="d-status-sig">● SENT</span>
          </div>
          <div className="d-grid-bg" />
          <div className="d-login-mast">
            <div className="d-spec-row">
              <span className="d-spec"><i>VOL</i><b>04</b></span>
              <span className="d-spec"><i>STA</i><b>PENDING</b></span>
              <span className="d-spec"><i>REV</i><b>A.0</b></span>
            </div>
            <h1 className="d-display">CHECK<br />YOUR INBOX.</h1>
            <div className="d-rule signal" />
            <p className="d-mono-cap">CONFIRMATION DISPATCHED · {email.toUpperCase()}</p>
          </div>
          <div className="d-login-panel">
            <div className="d-panel-head">
              <span className="d-panel-code">REG.04</span>
              <span className="d-panel-title">VERIFY</span>
              <span className="d-panel-corner" />
            </div>
            <div className="d-data-row">
              <span>STATUS</span>
              <span className="d-data-val ok">● TRANSMITTED</span>
            </div>
            <div className="d-data-row">
              <span>WINDOW</span>
              <span className="d-data-val">24 HOURS</span>
            </div>
            <button
              type="button"
              className="d-btn signal"
              onClick={() => { haptic('click'); setLocation('/login'); }}
              data-testid="button-back-to-login"
            >
              RETURN TO ACCESS ▸
            </button>
          </div>
          <div className="d-foot">
            <span>SN.REG.OK.A</span>
            <span className="d-foot-sig">● SENT</span>
            <span>{now}</span>
          </div>
        </div>
      </div>
    );
  }

  const stepCode = step === 1 ? 'REG.01' : step === 2 ? 'REG.02' : 'REG.03';
  const stepTitle = step === 1 ? 'IDENTITY' : step === 2 ? 'CREDENTIALS' : 'CONSENT';

  return (
    <div className="dir-d-root" data-testid="signup-direction-d">
      <div className="d-screen d-login">
        <div className="d-status">
          <span>{now}</span>
          <span className="d-status-c">REG-{step.toString().padStart(2, '0')}</span>
          <span className="d-status-sig">● ENC</span>
        </div>

        <div className="d-grid-bg" />

        <div className="d-login-mast">
          <div className="d-spec-row">
            <span className="d-spec"><i>VOL</i><b>04</b></span>
            <span className="d-spec"><i>STEP</i><b>{step}/3</b></span>
            <span className="d-spec"><i>REV</i><b>A.0</b></span>
          </div>
          <h1 className="d-display">JOIN<br />THE CIRCLE.</h1>
          <div className="d-rule signal" />
          <p className="d-mono-cap">REGISTRATION OPEN · OPERATOR-CLASS APPLICANTS</p>
        </div>

        <div className="d-login-panel">
          <div className="d-panel-head">
            <span className="d-panel-code">{stepCode}</span>
            <span className="d-panel-title">{stepTitle}</span>
            <span className="d-panel-corner" />
          </div>
          <div className="d-data-row">
            <span>OP-NAME</span>
            <span className={`d-data-val ${displayName ? 'ok' : 'dim'}`}>
              {displayName ? `● ${displayName.toUpperCase().slice(0, 14)}` : '— — — — — —'}
            </span>
          </div>
          <div className="d-data-row">
            <span>ZIP</span>
            <span className={`d-data-val ${zipCode.length === 5 ? 'ok' : 'dim'}`}>
              {zipCode.length === 5 ? `● ${zipCode}` : '— — — — —'}
            </span>
          </div>
          <button
            type="button"
            className="d-btn primary"
            onClick={() => { haptic('rise'); setOpen(true); }}
            data-testid="button-open-signup"
          >
            {step === 1 ? 'BEGIN REGISTRATION' : step === 2 ? 'CONTINUE REGISTRATION' : 'REVIEW CONSENT'}
          </button>
          <Link href="/login">
            <button type="button" className="d-btn ghost" data-testid="link-login">
              EXISTING OPERATOR ▸
            </button>
          </Link>
        </div>

        <div className="d-foot">
          <span>SN.REG.{step.toString().padStart(2, '0')}.A</span>
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
              data-testid="sheet-signup"
            >
              <div className="d-sheet-handle" aria-hidden />
              <div className="d-sheet-eyebrow">
                <span>● {stepCode} / {stepTitle}</span>
                <button
                  type="button"
                  className="d-sheet-close"
                  onClick={() => { haptic('soft'); setOpen(false); }}
                  aria-label="Close"
                  data-testid="button-close-signup"
                >×</button>
              </div>

              <h2 className="d-sheet-title">
                {step === 1
                  ? <>IDENTIFY<br />YOURSELF.</>
                  : step === 2
                    ? <>SET<br />CREDENTIALS.</>
                    : <>GRANT<br />CONSENT.</>}
              </h2>

              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.form
                    key="step1"
                    onSubmit={(e) => { e.preventDefault(); handleNextStep(); }}
                    className="d-form"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.24, ease: 'linear' }}
                  >
                    {error && <div className="d-err" data-testid="text-signup-error">{error}</div>}

                    <label className="d-field">
                      <span className="d-field-label">REAL NAME</span>
                      <input
                        type="text"
                        value={realName}
                        onChange={(e) => setRealName(e.target.value)}
                        autoComplete="name"
                        className="d-input"
                        placeholder="FULL NAME"
                        data-testid="input-real-name"
                      />
                    </label>

                    <label className="d-field">
                      <span className="d-field-label">OP-NAME</span>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoComplete="username"
                        className="d-input"
                        placeholder="HANDLE"
                        data-testid="input-display-name"
                      />
                    </label>

                    <label className="d-field">
                      <span className="d-field-label">ZIP</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                        maxLength={5}
                        className="d-input"
                        placeholder="48226"
                        data-testid="input-zip-code"
                      />
                    </label>

                    <button
                      type="submit"
                      className="d-btn signal"
                      data-testid="button-next-step"
                      style={{ width: '100%', margin: '4px 0 0' }}
                    >
                      CONTINUE ▸
                    </button>

                    <div className="d-sheet-foot">
                      <Link href="/login">
                        <a data-testid="link-login-sheet">RETURN TO ACCESS</a>
                      </Link>
                      <Link href="/request-invite">
                        <a data-testid="link-request-invite-sheet">REQUEST CLEARANCE</a>
                      </Link>
                    </div>
                  </motion.form>
                ) : step === 2 ? (
                  <motion.form
                    key="step2"
                    onSubmit={handleCredentialsNext}
                    className="d-form"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.24, ease: 'linear' }}
                  >
                    {error && <div className="d-err" data-testid="text-signup-error">{error}</div>}

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

                    <label className="d-field">
                      <span className="d-field-label">CLASS</span>
                      <select
                        value={userType}
                        onChange={(e) => setUserType(e.target.value)}
                        className="d-input"
                        data-testid="select-user-type"
                      >
                        {USER_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="d-field">
                      <span className="d-field-label">OP-CODE</span>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        className="d-input"
                        placeholder="••••••••"
                        data-testid="input-password"
                      />
                    </label>

                    <label className="d-field">
                      <span className="d-field-label">CONFIRM</span>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="d-input"
                        placeholder="••••••••"
                        data-testid="input-confirm-password"
                      />
                    </label>

                    <button
                      type="submit"
                      className="d-btn signal"
                      data-testid="button-next-step-2"
                      style={{ width: '100%', margin: '4px 0 0' }}
                    >
                      CONTINUE ▸
                    </button>

                    <div className="d-sheet-foot">
                      <a
                        onClick={() => { haptic('soft'); setStep(1); }}
                        data-testid="link-back-step"
                        style={{ cursor: 'pointer' }}
                      >◂ EDIT IDENTITY</a>
                      <Link href="/login">
                        <a data-testid="link-login-sheet-2">RETURN TO ACCESS</a>
                      </Link>
                    </div>
                  </motion.form>
                ) : (
                  <motion.form
                    key="step3"
                    onSubmit={handleSubmit}
                    className="d-form"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.24, ease: 'linear' }}
                  >
                    {error && <div className="d-err" data-testid="text-signup-error">{error}</div>}

                    <div
                      className="d-field-label"
                      style={{ marginBottom: 4, opacity: 0.85 }}
                    >
                      DATA SHARING — YOU CONTROL THIS. CHANGE ANYTIME IN PROFILE › PRIVACY.
                    </div>

                    {([
                      { key: 'shareConversations', label: 'SHARE CONVERSATIONS', sub: 'Allow care team to review Siani transcripts.' },
                      { key: 'shareLocation', label: 'SHARE LOCATION', sub: 'Match resources near you (ZIP-only when off).' },
                      { key: 'allowNotifications', label: 'ALLOW NOTIFICATIONS', sub: 'Drops, signals, vault unlocks, streak rescues.' },
                      { key: 'allowLeaderboard', label: 'APPEAR ON HEAT INDEX', sub: 'Show your handle in member rankings.' },
                    ] as const).map((row) => {
                      const checked = consent[row.key];
                      return (
                        <button
                          type="button"
                          key={row.key}
                          onClick={() => {
                            haptic('soft');
                            setConsent((c) => ({ ...c, [row.key]: !c[row.key] }));
                          }}
                          data-testid={`toggle-consent-${row.key}`}
                          aria-pressed={checked}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '12px 14px',
                            margin: '6px 0',
                            border: '1px solid var(--rim, rgba(255,255,255,0.12))',
                            background: 'var(--surface, rgba(255,255,255,0.04))',
                            color: 'var(--fog-100, #F6F8F7)',
                            textAlign: 'left',
                            width: '100%',
                            cursor: 'pointer',
                            borderRadius: 6,
                          }}
                        >
                          <span style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontWeight: 600, letterSpacing: '0.04em' }}>
                              {row.label}
                              <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.6, letterSpacing: '0.08em' }}>OPTIONAL</span>
                            </span>
                            <span style={{ display: 'block', fontSize: 11, opacity: 0.65, marginTop: 2 }}>{row.sub}</span>
                          </span>
                          <span
                            aria-hidden
                            style={{
                              width: 36,
                              height: 20,
                              borderRadius: 999,
                              position: 'relative',
                              background: checked ? 'var(--lime-core, #C7FF3E)' : 'rgba(255,255,255,0.18)',
                              transition: 'background 160ms linear',
                              flex: '0 0 auto',
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                top: 2,
                                left: checked ? 18 : 2,
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: checked ? '#12221A' : '#F6F8F7',
                                transition: 'left 160ms linear',
                              }}
                            />
                          </span>
                        </button>
                      );
                    })}

                    <label
                      className="d-field"
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 10,
                        margin: '12px 0 0',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        data-testid="checkbox-terms-accepted"
                        style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--lime-core, #C7FF3E)' }}
                      />
                      <span style={{ fontSize: 12, lineHeight: 1.4, opacity: 0.9 }}>
                        I ACCEPT THE <Link href="/terms"><a style={{ textDecoration: 'underline' }}>TERMS</a></Link> AND <Link href="/privacy-policy"><a style={{ textDecoration: 'underline' }}>PRIVACY POLICY</a></Link>. REQUIRED.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={isLoading || !termsAccepted}
                      className="d-btn signal"
                      data-testid="button-signup"
                      style={{ width: '100%', margin: '8px 0 0', opacity: termsAccepted ? 1 : 0.5 }}
                    >
                      {isLoading ? 'COMMITTING…' : 'COMMIT ▸'}
                    </button>

                    <div className="d-sheet-foot">
                      <a
                        onClick={() => { haptic('soft'); setStep(2); }}
                        data-testid="link-back-step-3"
                        style={{ cursor: 'pointer' }}
                      >◂ EDIT CREDENTIALS</a>
                      <Link href="/login">
                        <a data-testid="link-login-sheet-3">RETURN TO ACCESS</a>
                      </Link>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
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
