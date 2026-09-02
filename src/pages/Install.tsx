import { useState, useEffect } from 'react';
import { Download, Smartphone, Share, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useStoreName } from '@/hooks/useStoreName';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const navigate = useNavigate();
  const { storeName } = useStoreName();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check iOS
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <Button variant="ghost" className="absolute top-4 left-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5 mr-1" /> Back
        </Button>

        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto">
          <Smartphone className="w-10 h-10 text-primary-foreground" />
        </div>

        <h1 className="text-3xl font-bold">Install {storeName}</h1>

        {isInstalled ? (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-success" />
            </div>
            <p className="text-lg text-muted-foreground">
              App is already installed! Open it from your home screen.
            </p>
          </div>
        ) : isIOS ? (
          <div className="space-y-6">
            <p className="text-muted-foreground">
              Install this app on your iPhone for the best experience:
            </p>
            <div className="glass-card rounded-xl p-6 text-left space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <p>Tap the <Share className="w-4 h-4 inline mx-1" /> <strong>Share</strong> button in Safari</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <p>Scroll down and tap <strong>"Add to Home Screen"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <p>Tap <strong>"Add"</strong> to install</p>
              </div>
            </div>
          </div>
        ) : deferredPrompt ? (
          <div className="space-y-6">
            <p className="text-muted-foreground">
              Install this app for quick access, offline support, and a native app experience.
            </p>
            <Button size="lg" className="w-full h-14 text-lg" onClick={handleInstall}>
              <Download className="w-5 h-5 mr-2" />
              Install App
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              To install, open this page in Chrome or Edge and tap the install option in the browser menu.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 pt-4">
          {[
            { label: 'Offline', desc: 'Works without internet' },
            { label: 'Fast', desc: 'Instant loading' },
            { label: 'Secure', desc: 'HTTPS protected' },
          ].map((f) => (
            <div key={f.label} className="text-center">
              <p className="font-semibold text-sm">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
