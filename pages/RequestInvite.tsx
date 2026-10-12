import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNativeShell } from '@/hooks/useNativeShell';
import { Loader2, ChevronRight } from 'lucide-react';
import { Icons3D, Icon3DImage } from '@/lib/icons3d';
import { apiRequest } from '@/lib/queryClient';
import { motion } from 'framer-motion';
import bgImage from "@assets/NewlabROOFTOP-min-scaled-1_1764759126395.jpg";

type Step = 'request' | 'pending' | 'reviewing' | 'verify' | 'success';

// Using premium 3D clay icons per design guidelines
const HOW_DID_YOU_HEAR: { id: string; label: string; icon3d: keyof typeof Icons3D }[] = [
  { id: 'upcoming_event', label: 'Trying to get into an event', icon3d: 'ticket' },
  { id: 'event', label: 'Was at an event', icon3d: 'cinema' },
  { id: 'inner_circle', label: 'An inner circle member', icon3d: 'crown' },
  { id: 'friend', label: 'A friend told me', icon3d: 'chat' },
  { id: 'social', label: 'Social media', icon3d: 'community' },
  { id: 'flyer', label: 'Saw a flyer/poster', icon3d: 'badge' },
  { id: 'other', label: 'Other', icon3d: 'sparkles' },
];

const WHAT_YOU_SEEK = [
  { id: 'circle', label: 'The inner circle' },
  { id: 'plug', label: 'The plug' },
  { id: 'list', label: 'The list' },
  { id: 'lifestyle', label: 'The lifestyle' },
  { id: 'glow', label: 'The glow up' },
  { id: 'moves', label: 'Moves that matter' },
];

const WHAT_YOU_BRING = [
  { id: 'energy', label: 'Good energy' },
  { id: 'creativity', label: 'Creativity' },
  { id: 'connections', label: 'Connections' },
  { id: 'experience', label: 'Experience' },
  { id: 'vibes', label: 'Just vibes' },
];

export default function RequestInvite() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isStandalone } = useNativeShell();
  
  const [step, setStep] = useState<Step>('request');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [howHeard, setHowHeard] = useState('');
  const [whatSeek, setWhatSeek] = useState<string[]>([]);
  const [whatBring, setWhatBring] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formStep, setFormStep] = useState(1);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const getDigits = (phone: string) => phone.replace(/\D/g, '');

  const toggleSelection = (id: string, current: string[], setter: (val: string[]) => void) => {
    if (current.includes(id)) {
      setter(current.filter(x => x !== id));
    } else {
      setter([...current, id]);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const digits = getDigits(phoneNumber);
    if (digits.length !== 10) {
      setError('Enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest(
        'POST',
        '/api/invites/request',
        { 
          phone: `+1${digits}`,
          source: howHeard || 'organic',
          metadata: {
            seeking: whatSeek,
            bringing: whatBring,
          }
        }
      );
      const data = await res.json();
      
      setRequestId(data.requestId);
      setStep('pending');
      toast({
        title: '"REQUEST RECEIVED"',
        description: 'Your application is under review.',
      });
    } catch (err: any) {
      if (err.message?.includes('already')) {
        setError('This number already has a pending request');
      } else if (err.message?.includes('claimed')) {
        setError('This number is already a SAINTE member');
      } else {
        setError(err.message || 'Failed to submit request');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (verificationCode.length !== 6) {
      setError('Enter your 6-character invite code');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest(
        'POST',
        '/api/invites/verify',
        { code: verificationCode }
      );
      const data = await res.json();
      
      if (data.valid) {
        setStep('success');
        toast({
          title: '"ACCESS GRANTED"',
          description: 'Welcome to SAINTE.',
        });
      }
    } catch (err: any) {
      if (err.message?.includes('expired')) {
        setError('Code expired. Request a new invite.');
      } else if (err.message?.includes('attempts')) {
        setError('Too many attempts. Request locked.');
      } else {
        setError(err.message || 'Invalid code');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    if (formStep === 1) return getDigits(phoneNumber).length === 10;
    return true;
  };

  return (
    <div className="min-h-screen app-ground text-white flex flex-col relative overflow-hidden">
      {/* Full-bleed SAINTE background image */}
      <div className="absolute inset-0">
        <img src={bgImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/75 to-black/90" />
      </div>
      <div className="absolute inset-0 pointer-events-none grain-overlay" />
      
      <header className="p-6 border-b border-smoke relative z-10">
        <div className="text-center">
          <h1 className="text-broken-display text-3xl tracking-[0.4em] text-white">SAINTE</h1>
          <p className="text-[10px] tracking-[0.5em] text-steel mt-1">"MEMBERS ONLY"</p>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <motion.div 
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="w-full max-w-md"
        >
          {step === 'request' && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div 
                  className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-charcoal border border-t-smoke/30 border-l-smoke/30 border-b-black/50 border-r-black/50"
                  style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.5), inset 1px 1px 3px rgba(255,255,255,0.03)' }}
                >
                  <Icon3DImage icon="crown" size={32} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-[0.2em] uppercase">Request Access</h2>
                  <p className="text-white/40 text-sm mt-2 tracking-wide">
                    You've been noticed. Let's make it official.
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-mint-200/10 border border-mint-300/30 rounded">
                  <p className="text-sm text-[#C26D5A] text-center">{error}</p>
                </div>
              )}

              <form onSubmit={handleRequestSubmit} className="space-y-6">
                {formStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="space-y-3">
                      <Label className="text-[10px] tracking-[0.3em] text-white/60">YOUR NUMBER</Label>
                      <Input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                        placeholder="(555) 123-4567"
                        className="bg-white/5 border-white/10 text-white h-12 text-lg"
                        data-testid="input-phone"
                      />
                      <p className="text-[10px] text-white/30 tracking-wide">
                        We'll text you when you're in
                      </p>
                    </div>

                    <Button 
                      type="button"
                      onClick={() => canProceed() && setFormStep(2)}
                      className="w-full min-h-12 py-3 bg-white/10 hover:bg-white/15 text-white font-bold tracking-[0.1em]"
                      disabled={!canProceed()}
                      data-testid="button-next-step"
                    >
                      CONTINUE <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.div>
                )}

                {formStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="space-y-3">
                      <Label className="text-[10px] tracking-[0.3em] text-white/60">HOW'D YOU FIND US?</Label>
                      <p className="text-[10px] text-white/30">(optional - helps us know our people)</p>
                      <div className="grid grid-cols-2 gap-2">
                        {HOW_DID_YOU_HEAR.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setHowHeard(option.id)}
                            className={`p-3 rounded-lg flex items-center gap-3 text-left text-sm transition-all ${
                              howHeard === option.id 
                                ? 'bg-crimson/20 border border-crimson/50 text-white' 
                                : 'bg-charcoal border border-t-smoke/30 border-l-smoke/30 border-b-black/50 border-r-black/50 text-silver hover:text-white'
                            }`}
                            style={{
                              boxShadow: howHeard === option.id 
                                ? '3px 3px 8px rgba(0,0,0,0.5), inset 1px 1px 2px rgba(255,255,255,0.1)'
                                : '3px 3px 8px rgba(0,0,0,0.4), inset 1px 1px 2px rgba(255,255,255,0.02)'
                            }}
                            data-testid={`option-how-${option.id}`}
                          >
                            <Icon3DImage icon={option.icon3d} size={24} />
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        type="button"
                        onClick={() => setFormStep(1)}
                        variant="outline"
                        className="border-white/10 text-white/60 hover:bg-white/5"
                      >
                        Back
                      </Button>
                      <Button 
                        type="button"
                        onClick={() => setFormStep(3)}
                        className="flex-1 min-h-12 py-3 bg-white/10 hover:bg-white/15 text-white font-bold tracking-[0.1em]"
                        data-testid="button-next-step-2"
                      >
                        CONTINUE <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {formStep === 3 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="space-y-3">
                      <Label className="text-[10px] tracking-[0.3em] text-white/60">WHAT ARE YOU HERE FOR?</Label>
                      <p className="text-[10px] text-white/30">(tap all that apply)</p>
                      <div className="flex flex-wrap gap-2">
                        {WHAT_YOU_SEEK.map((option) => {
                          const isSelected = whatSeek.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleSelection(option.id, whatSeek, setWhatSeek)}
                              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                                isSelected
                                  ? 'bg-crimson/20 border border-crimson/50 text-white' 
                                  : 'bg-charcoal border border-t-smoke/50 border-l-smoke/50 border-b-black/40 border-r-black/40 text-silver hover:text-white'
                              }`}
                              style={{
                                boxShadow: isSelected 
                                  ? '2px 2px 6px rgba(0,0,0,0.5), inset 1px 1px 2px rgba(255,255,255,0.1)'
                                  : '2px 2px 6px rgba(0,0,0,0.3), inset 1px 1px 2px rgba(255,255,255,0.02)'
                              }}
                              data-testid={`option-seek-${option.id}`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        type="button"
                        onClick={() => setFormStep(2)}
                        variant="outline"
                        className="border-white/10 text-white/60 hover:bg-white/5"
                      >
                        Back
                      </Button>
                      <Button 
                        type="button"
                        onClick={() => setFormStep(4)}
                        className="flex-1 min-h-12 py-3 bg-white/10 hover:bg-white/15 text-white font-bold tracking-[0.1em]"
                        data-testid="button-next-step-3"
                      >
                        ALMOST THERE <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {formStep === 4 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon3DImage icon="sparkles" size={16} />
                        <Label className="text-[10px] tracking-[0.3em] text-white/60">WHAT DO YOU BRING TO THE TABLE?</Label>
                      </div>
                      <p className="text-[10px] text-white/30">(everyone's got something - pick yours)</p>
                      <div className="flex flex-wrap gap-2">
                        {WHAT_YOU_BRING.map((option) => {
                          const isSelected = whatBring.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleSelection(option.id, whatBring, setWhatBring)}
                              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                                isSelected
                                  ? 'bg-crimson/20 border border-crimson/50 text-white' 
                                  : 'bg-charcoal border border-t-smoke/50 border-l-smoke/50 border-b-black/40 border-r-black/40 text-silver hover:text-white'
                              }`}
                              style={{
                                boxShadow: isSelected 
                                  ? '2px 2px 6px rgba(0,0,0,0.5), inset 1px 1px 2px rgba(255,255,255,0.1)'
                                  : '2px 2px 6px rgba(0,0,0,0.3), inset 1px 1px 2px rgba(255,255,255,0.02)'
                              }}
                              data-testid={`option-bring-${option.id}`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="p-4 bg-white/5 rounded border border-white/10">
                      <p className="text-xs text-white/60 text-center">
                        <span className="text-mint-200">You're almost in.</span> We review every request personally.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        type="button"
                        onClick={() => setFormStep(3)}
                        variant="outline"
                        className="border-white/10 text-white/60 hover:bg-white/5"
                      >
                        Back
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1 min-h-12 py-3 bg-mint-200 hover:bg-mint-300 text-everglade-950 font-bold tracking-[0.2em] uppercase"
                        disabled={isLoading}
                        data-testid="button-request-invite"
                      >
                        {isLoading ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> SUBMITTING...</>
                        ) : (
                          <>REQUEST ACCESS</>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </form>

              <div className="flex justify-center">
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((s) => (
                    <div
                      key={s}
                      className={`w-2 h-2 rounded-full transition-all ${
                        formStep === s ? 'bg-mint-200 w-6' : 'bg-white/20'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-4">
                <div className="flex items-center gap-3 text-white/40 text-xs">
                  <Icon3DImage icon="shield" size={16} className="flex-shrink-0" />
                  <span>Your info stays private</span>
                </div>
              </div>

              <div className="text-center">
                <span className="text-white/40 text-sm">Already have a code? </span>
                <button 
                  onClick={() => setStep('verify')}
                  className="text-mint-200 hover:underline text-sm font-semibold tracking-wide"
                  data-testid="link-have-code"
                >
                  ENTER IT
                </button>
              </div>
            </div>
          )}

          {step === 'pending' && (
            <div className="text-center space-y-8">
              <div 
                className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-charcoal border border-t-smoke/30 border-l-smoke/30 border-b-black/50 border-r-black/50"
                style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.5), inset 1px 1px 3px rgba(255,255,255,0.03)' }}
              >
                <Icon3DImage icon="clock" size={40} />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-xl font-bold tracking-[0.2em] uppercase">"Under Review"</h2>
                <p className="text-white/60 text-sm leading-relaxed">
                  We see you. Your request is in.<br />
                  We'll text you when you're approved.
                </p>
              </div>

              <div className="p-4 bg-white/5 rounded border border-white/10">
                <p className="text-[10px] tracking-[0.3em] text-white/40 mb-2">YOUR REQUEST</p>
                <p className="font-mono text-white/80">{requestId?.slice(0, 8).toUpperCase()}</p>
              </div>

              <div className="text-xs text-white/40 space-y-2">
                <p>Most requests are reviewed within 24 hours.</p>
                <p>Keep your phone nearby.</p>
              </div>

              <Button 
                onClick={() => setStep('verify')}
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                data-testid="button-enter-code"
              >
                I HAVE A CODE
              </Button>
            </div>
          )}

          {step === 'reviewing' && (
            <div className="text-center space-y-8">
              <motion.div 
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-charcoal border border-t-smoke/30 border-l-smoke/30 border-b-black/50 border-r-black/50"
                style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.5), inset 1px 1px 3px rgba(255,255,255,0.03)' }}
              >
                <Icon3DImage icon="shield" size={40} />
              </motion.div>
              
              <div className="space-y-3">
                <motion.h2 
                  className="text-xl font-bold tracking-[0.2em] uppercase"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  "Reviewing Your Application"
                </motion.h2>
                <p className="text-white/60 text-sm leading-relaxed">
                  We're checking your credentials...<br />
                  This won't take long.
                </p>
              </div>

              <div className="space-y-3">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-mint-300 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 3.2, ease: "easeInOut" }}
                  />
                </div>
                <p className="text-[10px] tracking-[0.3em] text-white/30">VERIFYING STATUS</p>
              </div>

              <div className="p-4 bg-white/5 rounded border border-white/10">
                <p className="text-[10px] tracking-[0.3em] text-white/40 mb-2">REQUEST ID</p>
                <p className="font-mono text-white/80">{requestId?.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <div 
                  className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-charcoal border border-t-smoke/30 border-l-smoke/30 border-b-black/50 border-r-black/50"
                  style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.5), inset 1px 1px 3px rgba(255,255,255,0.03)' }}
                >
                  <Icon3DImage icon="lock" size={32} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-[0.2em] uppercase">Enter Code</h2>
                  <p className="text-white/40 text-sm mt-2">
                    Input your 6-digit invite code
                  </p>
                </div>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-6">
                {error && (
                  <div className="p-3 bg-mint-200/10 border border-mint-300/30 rounded">
                    <p className="text-sm text-[#C26D5A] text-center">{error}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <Label className="text-[10px] tracking-[0.3em] text-white/60">INVITE CODE</Label>
                  <Input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6))}
                    placeholder="ABC123"
                    className="bg-white/5 border-white/10 text-white h-14 text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                    data-testid="input-invite-code"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full min-h-12 py-3 bg-mint-200 hover:bg-mint-300 text-everglade-950 font-bold tracking-[0.2em] uppercase"
                  disabled={isLoading || verificationCode.length !== 6}
                  data-testid="button-verify-code"
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> VERIFYING...</>
                  ) : (
                    'UNLOCK ACCESS'
                  )}
                </Button>
              </form>

              <div className="text-center">
                <button 
                  onClick={() => setStep('request')}
                  className="text-white/40 hover:text-white/60 text-sm"
                  data-testid="link-back-to-request"
                >
                  Back to request
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center space-y-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="inline-flex items-center justify-center w-24 h-24 rounded-xl bg-charcoal border border-t-smoke/30 border-l-smoke/30 border-b-black/50 border-r-black/50"
                style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.5), inset 1px 1px 3px rgba(255,255,255,0.03)' }}
              >
                <Icon3DImage icon="check" size={48} />
              </motion.div>
              
              <div className="space-y-3">
                <h2 className="text-2xl font-black tracking-[0.2em] uppercase">"You're In"</h2>
                <p className="text-white/60 text-sm leading-relaxed">
                  Welcome to SAINTE.<br />
                  Your membership awaits.
                </p>
              </div>

              <div className="p-6 bg-white/5 rounded border border-white/10 space-y-4">
                <p className="text-[10px] tracking-[0.3em] text-white/40">NEXT STEPS</p>
                <ol className="text-left space-y-3 text-sm text-white/80">
                  {!isStandalone && (
                    <li className="flex gap-3">
                      <span className="text-mint-200 font-bold">1.</span>
                      Download the SAINTE app
                    </li>
                  )}
                  <li className="flex gap-3">
                    <span className="text-mint-200 font-bold">{isStandalone ? '1.' : '2.'}</span>
                    Sign up with this phone number
                  </li>
                  <li className="flex gap-3">
                    <span className="text-mint-200 font-bold">{isStandalone ? '2.' : '3.'}</span>
                    Access your membership card
                  </li>
                </ol>
              </div>

              <Button 
                onClick={() => setLocation('/signup')}
                className="w-full min-h-12 py-3 bg-mint-200 hover:bg-mint-300 text-everglade-950 font-bold tracking-[0.2em] uppercase"
                data-testid="button-create-account"
              >
                CREATE ACCOUNT
              </Button>
            </div>
          )}
        </motion.div>
      </main>

      <footer className="p-6 border-t border-white/5 text-center">
        <Link href="/login">
          <span className="text-white/40 hover:text-white/60 text-sm cursor-pointer" data-testid="link-back-to-login">
            Already a member? Sign in
          </span>
        </Link>
      </footer>
    </div>
  );
}
