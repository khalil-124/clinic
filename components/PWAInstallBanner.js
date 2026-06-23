'use client';

import { useState, useEffect } from 'react';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('pwa_banner_dismissed');
    if (isDismissed) {
      setIsVisible(false);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Safari on iOS detection (which does not support beforeinstallprompt)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS && !isStandalone) {
      const hasIOSPromptShown = localStorage.getItem('ios_pwa_prompt_shown');
      if (!hasIOSPromptShown) {
        setIsVisible(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install prompt outcome: ${outcome}`);
      setDeferredPrompt(null);
      setIsVisible(false);
    } else {
      // iOS instructions popup
      alert('لتثبيت التطبيق على جهاز الآيفون (iOS):\n1. اضغط على زر "مشاركة" (Share) في متصفح Safari بالأسفل.\n2. اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).');
      localStorage.setItem('ios_pwa_prompt_shown', 'true');
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
    localStorage.setItem('ios_pwa_prompt_shown', 'true');
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      right: '20px',
      background: 'rgba(15, 45, 66, 0.96)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '16px',
      padding: '16px 20px',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
      color: '#ffffff',
      direction: 'rtl',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          fontSize: '28px',
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '8px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          🦷
        </div>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700 }}>تطبيق عيادة د. محمد ذبالح</h4>
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.75)', lineHeight: '1.4' }}>
            ثبّت التطبيق الآن للوصول السريع لملفات المرضى والمواعيد!
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button 
          onClick={handleInstallClick}
          style={{
            background: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          📲 تثبيت
        </button>
        <button 
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            color: 'rgba(255, 255, 255, 0.6)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          ليس الآن
        </button>
      </div>
    </div>
  );
}
