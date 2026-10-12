import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  QrCode, 
  CheckCircle2, 
  XCircle, 
  Users, 
  Clock, 
  Shield,
  Wifi,
  WifiOff,
  RefreshCw,
  Camera,
  Keyboard,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  capacity: number;
  checkedInCount: number;
}

interface CheckInResult {
  success: boolean;
  member?: {
    displayName: string;
    tier: string;
    serialNumber: string;
  };
  alreadyCheckedIn?: boolean;
  message: string;
}

type InputMode = 'manual' | 'scanner';

export default function EventCheckIn() {
  const { user } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [inputMode, setInputMode] = useState<InputMode>('manual');
  const [manualCode, setManualCode] = useState('');
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events/staff/list'],
    enabled: !!user,
  });

  const selectedEvent = events?.find(e => e.id === selectedEventId);

  const checkInMutation = useMutation({
    mutationFn: async ({ eventId, token, userId }: { eventId: string; token?: string; userId?: string }) => {
      const res = await apiRequest('POST', `/api/events/${eventId}/checkin`, { token, userId });
      return res.json();
    },
    onSuccess: (data: CheckInResult) => {
      setLastResult(data);
      setShowResult(true);
      setManualCode('');
      queryClient.invalidateQueries({ queryKey: ['/api/events/staff/list'] });
      
      setTimeout(() => {
        setShowResult(false);
        inputRef.current?.focus();
      }, 3000);
    },
    onError: (error: any) => {
      setLastResult({
        success: false,
        message: error.message || 'Check-in failed',
      });
      setShowResult(true);
      setManualCode('');
      
      setTimeout(() => {
        setShowResult(false);
        inputRef.current?.focus();
      }, 3000);
    },
  });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !manualCode.trim()) return;
    
    const code = manualCode.trim();
    
    // If it looks like a JWT (long string with dots), use it directly
    if (code.includes('.') && code.length > 50) {
      checkInMutation.mutate({
        eventId: selectedEventId,
        token: code,
      });
      return;
    }
    
    // Otherwise try to verify it first (could be serial number or short token)
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const verifyRes = await apiRequest('POST', '/api/membership/verify', {
        token: code,
        eventId: selectedEventId,
      });
      const verifyData = await verifyRes.json();
      
      if (verifyData.valid && verifyData.member?.id) {
        // Use the verified userId for check-in
        checkInMutation.mutate({
          eventId: selectedEventId,
          userId: verifyData.member.id,
        });
      } else {
        setVerifyError(verifyData.message || 'Invalid code or membership');
        setShowResult(true);
        setLastResult({
          success: false,
          message: verifyData.message || 'Could not verify membership',
        });
        setTimeout(() => {
          setShowResult(false);
          inputRef.current?.focus();
        }, 3000);
      }
    } catch (err: any) {
      // If verification fails, try submitting as a raw token anyway
      checkInMutation.mutate({
        eventId: selectedEventId,
        token: code,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleScanInput = (value: string) => {
    if (!selectedEventId) return;
    
    try {
      const parsed = JSON.parse(value);
      if (parsed.eventId && parsed.token) {
        checkInMutation.mutate({
          eventId: parsed.eventId,
          token: parsed.token,
        });
      }
    } catch {
      if (value.length > 20) {
        checkInMutation.mutate({
          eventId: selectedEventId,
          token: value,
        });
      }
    }
  };

  if (eventsLoading) {
    return (
      <div className="min-h-screen of-bg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-mint-200" />
      </div>
    );
  }

  return (
    <div className="min-h-screen of-bg text-fog-100">
      <header className="sticky top-0 z-10 bg-everglade-900/80 backdrop-blur border-b border-white/5 p-4">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div>
            <h1 className="text-lg font-bold tracking-[0.2em]">DOOR CHECK-IN</h1>
            <p className="text-[10px] tracking-wider text-white/40">STAFF INTERFACE</p>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <div className="flex items-center gap-1 text-green-400 text-xs">
                <Wifi className="w-4 h-4" />
                <span>LIVE</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-amber-400 text-xs">
                <WifiOff className="w-4 h-4" />
                <span>OFFLINE</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="space-y-3">
          <Label className="text-[10px] tracking-[0.3em] text-white/60">SELECT EVENT</Label>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger 
              className="bg-white/5 border-white/10 text-white h-12"
              data-testid="select-event"
            >
              <SelectValue placeholder="Choose event to manage" />
            </SelectTrigger>
            <SelectContent className="bg-everglade-800 border-white/10">
              {events?.map((event) => (
                <SelectItem 
                  key={event.id} 
                  value={event.id}
                  className="text-white hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{event.name}</span>
                    <span className="text-white/40 text-xs">
                      {new Date(event.date).toLocaleDateString()}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedEvent && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center">
                <Users className="w-5 h-5 text-mint-200 mx-auto mb-2" />
                <p className="text-xl font-bold" data-testid="text-checked-in">
                  {selectedEvent.checkedInCount}
                </p>
                <p className="text-[10px] text-white/40 tracking-wider">CHECKED IN</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center">
                <Shield className="w-5 h-5 text-white/40 mx-auto mb-2" />
                <p className="text-xl font-bold" data-testid="text-capacity">
                  {selectedEvent.capacity}
                </p>
                <p className="text-[10px] text-white/40 tracking-wider">CAPACITY</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-center">
                <Clock className="w-5 h-5 text-white/40 mx-auto mb-2" />
                <p className="text-xl font-bold">
                  {Math.round((selectedEvent.checkedInCount / selectedEvent.capacity) * 100)}%
                </p>
                <p className="text-[10px] text-white/40 tracking-wider">FILLED</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={inputMode === 'manual' ? 'default' : 'outline'}
                onClick={() => setInputMode('manual')}
                className={`flex-1 ${inputMode === 'manual' ? 'bg-mint-200 hover:bg-mint-300 text-everglade-950' : 'border-white/10 text-white hover:bg-white/5'}`}
                data-testid="button-manual-mode"
              >
                <Keyboard className="w-4 h-4 mr-2" />
                MANUAL
              </Button>
              <Button
                variant={inputMode === 'scanner' ? 'default' : 'outline'}
                onClick={() => setInputMode('scanner')}
                className={`flex-1 ${inputMode === 'scanner' ? 'bg-mint-200 hover:bg-mint-300 text-everglade-950' : 'border-white/10 text-white hover:bg-white/5'}`}
                data-testid="button-scanner-mode"
              >
                <Camera className="w-4 h-4 mr-2" />
                SCANNER
              </Button>
            </div>

            <AnimatePresence mode="wait">
              {showResult && lastResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`p-6 rounded-xl border ${
                    lastResult.success 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-red-500/10 border-red-500/30'
                  }`}
                  data-testid="card-result"
                >
                  <div className="flex items-center gap-4">
                    {lastResult.success ? (
                      <CheckCircle2 className="w-12 h-12 text-green-400" />
                    ) : (
                      <XCircle className="w-12 h-12 text-red-400" />
                    )}
                    <div>
                      <p className={`text-lg font-bold ${lastResult.success ? 'text-green-400' : 'text-red-400'}`}>
                        {lastResult.success ? 'CHECKED IN' : 'DENIED'}
                      </p>
                      {lastResult.member && (
                        <>
                          <p className="text-white font-medium">{lastResult.member.displayName}</p>
                          <p className="text-white/40 text-sm">
                            {lastResult.member.tier.toUpperCase()} • {lastResult.member.serialNumber}
                          </p>
                        </>
                      )}
                      {lastResult.alreadyCheckedIn && (
                        <p className="text-amber-400 text-sm flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3" />
                          Already checked in
                        </p>
                      )}
                      {!lastResult.success && !lastResult.alreadyCheckedIn && (
                        <p className="text-white/60 text-sm mt-1">{lastResult.message}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showResult && inputMode === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-[10px] tracking-[0.3em] text-white/60">
                    MEMBERSHIP CODE OR TOKEN
                  </Label>
                  <Input
                    ref={inputRef}
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Enter or scan member code"
                    className="bg-white/5 border-white/10 text-white h-14 text-lg font-mono"
                    autoFocus
                    data-testid="input-manual-code"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full min-h-12 py-3 bg-mint-200 hover:bg-mint-300 text-everglade-950 font-bold tracking-wider"
                  disabled={!manualCode.trim() || checkInMutation.isPending}
                  data-testid="button-check-in"
                >
                  {checkInMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> CHECKING...</>
                  ) : (
                    'CHECK IN'
                  )}
                </Button>
              </form>
            )}

            {!showResult && inputMode === 'scanner' && (
              <div className="space-y-4">
                <div className="aspect-square max-w-xs mx-auto bg-white/5 rounded-xl border border-white/10 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-4 border-2 border-dashed border-mint-300/50 rounded-lg" />
                  <div className="text-center">
                    <QrCode className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40 text-sm">Point camera at QR code</p>
                    <p className="text-[10px] text-white/20 mt-2">
                      Or use a USB scanner
                    </p>
                  </div>
                  <input
                    type="text"
                    className="absolute inset-0 opacity-0 cursor-default"
                    autoFocus
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        handleScanInput(value);
                        e.target.value = '';
                      }
                    }}
                    data-testid="input-scanner"
                  />
                </div>
                <p className="text-center text-white/40 text-xs">
                  Scanner will auto-submit when QR is detected
                </p>
              </div>
            )}
          </>
        )}

        {!selectedEventId && events && events.length > 0 && (
          <div className="text-center py-12">
            <ChevronDown className="w-8 h-8 text-white/20 mx-auto mb-4 animate-bounce" />
            <p className="text-white/40">Select an event above to begin check-ins</p>
          </div>
        )}

        {events?.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 mb-2">No events available</p>
            <p className="text-white/40 text-sm">
              Contact admin to be assigned to an event
            </p>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-everglade-900/80 backdrop-blur border-t border-white/5 p-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/events/staff/list'] })}
            className="text-white/40 hover:text-white"
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            REFRESH
          </Button>
          <p className="text-[10px] text-white/30 tracking-wider">
            SAINTE DOOR SYSTEM v1.0
          </p>
        </div>
      </footer>
    </div>
  );
}
