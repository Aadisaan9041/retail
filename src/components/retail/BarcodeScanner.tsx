import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, ScanLine, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualBarcode, setManualBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Check for BarcodeDetector API support
  const hasBarcodeDetector = 'BarcodeDetector' in window;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
        setHasCamera(true);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setHasCamera(false);
      setMode('manual');
      toast({
        title: 'Camera Access Denied',
        description: 'Please use manual entry or grant camera permissions.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Barcode detection loop
  useEffect(() => {
    if (!isOpen || mode !== 'camera' || !isScanning || !hasBarcodeDetector) return;

    // @ts-ignore - BarcodeDetector is not in TypeScript types yet
    const barcodeDetector = new window.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'qr_code']
    });

    let animationId: number;

    const detectBarcode = async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) {
        animationId = requestAnimationFrame(detectBarcode);
        return;
      }

      try {
        const barcodes = await barcodeDetector.detect(videoRef.current);
        if (barcodes.length > 0) {
          const barcode = barcodes[0].rawValue;
          onScan(barcode);
          stopCamera();
          onClose();
          return;
        }
      } catch (err) {
        console.error('Barcode detection error:', err);
      }

      animationId = requestAnimationFrame(detectBarcode);
    };

    animationId = requestAnimationFrame(detectBarcode);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isOpen, mode, isScanning, hasBarcodeDetector, onScan, onClose, stopCamera]);

  useEffect(() => {
    if (isOpen && mode === 'camera') {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, mode, startCamera, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
      setManualBarcode('');
      onClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setManualBarcode('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5" />
            Barcode Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'camera' ? 'default' : 'outline'}
              onClick={() => setMode('camera')}
              disabled={!hasCamera}
              className="flex-1"
            >
              <Camera className="w-4 h-4 mr-2" />
              Camera
            </Button>
            <Button
              variant={mode === 'manual' ? 'default' : 'outline'}
              onClick={() => setMode('manual')}
              className="flex-1"
            >
              <Keyboard className="w-4 h-4 mr-2" />
              Manual
            </Button>
          </div>

          {mode === 'camera' ? (
            <div className="relative aspect-[4/3] bg-secondary rounded-lg overflow-hidden">
              {!hasBarcodeDetector ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                  <Camera className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Barcode scanning is not supported in this browser.
                    Please use manual entry or try Chrome/Edge on Android.
                  </p>
                  <Button 
                    className="mt-4" 
                    onClick={() => setMode('manual')}
                  >
                    Use Manual Entry
                  </Button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Scanning overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 border-2 border-primary/50" />
                    <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-primary animate-pulse" />
                  </div>
                  
                  {isScanning && (
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <span className="bg-background/80 px-3 py-1 rounded-full text-xs">
                        Point camera at barcode
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <Input
                  placeholder="Enter barcode or SKU..."
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  className="input-retail text-lg h-12"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use a USB/Bluetooth barcode scanner or type manually
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={!manualBarcode.trim()}>
                Add Product
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
