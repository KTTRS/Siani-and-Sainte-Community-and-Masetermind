import { useEffect, useCallback, useState } from 'react';

interface NativeShellState {
  isInstalled: boolean;
  isOnline: boolean;
  canInstall: boolean;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useNativeShell() {
  const [state, setState] = useState<NativeShellState>({
    isInstalled: false,
    isOnline: navigator.onLine,
    canInstall: false,
    safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
    isIOS: false,
    isAndroid: false,
    isStandalone: false,
  });

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    
    const computeSafeAreaInsets = () => {
      const style = getComputedStyle(document.documentElement);
      return {
        top: parseInt(style.getPropertyValue('--sat') || '0', 10) || 
             (isIOS && isStandalone ? 47 : 0),
        bottom: parseInt(style.getPropertyValue('--sab') || '0', 10) || 
                (isIOS && isStandalone ? 34 : 0),
        left: parseInt(style.getPropertyValue('--sal') || '0', 10) || 0,
        right: parseInt(style.getPropertyValue('--sar') || '0', 10) || 0,
      };
    };

    setState(prev => ({
      ...prev,
      isIOS,
      isAndroid,
      isStandalone,
      isInstalled: isStandalone,
      safeAreaInsets: computeSafeAreaInsets(),
    }));

    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));
    
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setState(prev => ({ ...prev, canInstall: true }));
    };

    const handleAppInstalled = () => {
      setState(prev => ({ ...prev, isInstalled: true, canInstall: false }));
      deferredPrompt = null;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (isStandalone) {
      // Only prevent overscroll bounce, don't block scrolling
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
      // Don't set overflow:hidden as it blocks internal scrolling
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      
      if (isStandalone) {
        document.body.style.overscrollBehavior = '';
        document.documentElement.style.overscrollBehavior = '';
      }
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      setState(prev => ({ ...prev, canInstall: false }));
      return outcome === 'accepted';
    } catch (err) {
      console.error('Install prompt error:', err);
      return false;
    }
  }, []);

  return {
    ...state,
    promptInstall,
  };
}

export function useHapticFeedback() {
  const vibrate = useCallback((pattern: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
    // Use Vibration API (works on Android, not iOS Safari)
    if ('vibrate' in navigator) {
      const patterns: Record<string, number | number[]> = {
        light: 20,
        medium: 40,
        heavy: 80,
        success: [20, 80, 20],
        error: [80, 120, 80],
      };
      
      try {
        const result = navigator.vibrate(patterns[pattern] || 20);
        if (result) return; // Success on Android
      } catch (e) {
        // Fall through to visual feedback
      }
    }
    
    // iOS/Safari fallback: Create visual micro-interaction
    // Brief screen flash effect to simulate haptic feedback
    const flashIntensity = pattern === 'heavy' || pattern === 'error' ? 0.15 : 
                          pattern === 'medium' ? 0.1 : 0.06;
    const flashDuration = pattern === 'heavy' || pattern === 'error' ? 100 : 
                         pattern === 'medium' ? 60 : 40;
    const flashColor = pattern === 'error' ? 'rgba(194,109,90,0.18)' : 
                      pattern === 'success' ? 'rgba(34,197,94,0.12)' : 
                      'rgba(255,255,255,0.08)';
    
    // Create flash overlay
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 99999;
      background: ${flashColor};
      opacity: 0;
      transition: opacity ${flashDuration}ms ease-out;
    `;
    document.body.appendChild(flash);
    
    // Trigger flash
    requestAnimationFrame(() => {
      flash.style.opacity = String(flashIntensity);
      setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(flash);
        }, flashDuration);
      }, flashDuration);
    });
  }, []);

  return { vibrate };
}

export function useHardwareBack(callback: () => boolean) {
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (callback()) {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [callback]);
}

export function usePullToRefresh(onRefresh: () => Promise<void>, enabled = true) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  
  useEffect(() => {
    if (!enabled) return;
    
    let startY = 0;
    let currentY = 0;
    const threshold = 80;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (startY === 0) return;
      currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      
      if (diff > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(diff * 0.5, threshold * 1.5));
        if (diff > threshold) {
          e.preventDefault();
        }
      }
    };
    
    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }
      setPullDistance(0);
      startY = 0;
    };
    
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onRefresh, isRefreshing, pullDistance]);
  
  return { isRefreshing, pullDistance };
}

export function useWakeLock() {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return false;
    
    try {
      const lock = await (navigator as any).wakeLock.request('screen');
      setWakeLock(lock);
      
      lock.addEventListener('release', () => {
        setWakeLock(null);
      });
      
      return true;
    } catch (err) {
      console.error('Wake lock error:', err);
      return false;
    }
  }, []);
  
  const releaseWakeLock = useCallback(async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
    }
  }, [wakeLock]);
  
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLock === null) {
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [wakeLock]);
  
  return { wakeLock, requestWakeLock, releaseWakeLock, isLocked: !!wakeLock };
}

interface WakeLockSentinel extends EventTarget {
  readonly released: boolean;
  readonly type: 'screen';
  release(): Promise<void>;
}
