import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, ScanLine, Keyboard, Loader2, Sparkles, Package, Search, Image, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useMarketplaceIntegration } from '@/hooks/useMarketplaceIntegration';
import { Product } from '@/types/retail';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface AIBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  onProductFound?: (product: Product) => void;
  products: Product[];
}

interface ImageMatch {
  productId: string;
  productName: string;
  sku: string;
  matchScore: number;
  matchReason: string;
  product: Product | null;
}

interface ImageAnalysis {
  productType: string;
  colors: string[];
  style: string;
  textDetected: string;
  material: string;
  confidence: string;
}

export function AIBarcodeScanner({ isOpen, onClose, onScan, onProductFound, products }: AIBarcodeScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual' | 'image'>('image');
  const [manualBarcode, setManualBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Partial<Product>[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageMatches, setImageMatches] = useState<ImageMatch[]>([]);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const { lookupBarcode, isLookingUp } = useMarketplaceIntegration();

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

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  const handleImageScan = useCallback(async () => {
    const imageData = captureFrame();
    if (!imageData) {
      toast({ title: 'Capture Failed', description: 'Could not capture image from camera.', variant: 'destructive' });
      return;
    }

    setCapturedImage(imageData);
    setIsAnalyzing(true);
    setImageMatches([]);
    setImageAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-image-product-match', {
        body: { imageBase64: imageData },
      });

      if (error) throw error;

      if (data?.success) {
        setImageAnalysis(data.analysis);
        const matches = data.matches || [];
        setImageMatches(matches);

        if (matches.length === 0) {
          toast({ title: 'No Match Found', description: `Detected: ${data.analysis?.productType || 'Unknown item'}. No matching product in inventory.` });
        } else if (matches[0]?.matchScore >= 0.9 && matches[0]?.product) {
          // High confidence is still only a suggestion. The POS must confirm
          // the product/variant and negotiated price before adding it to the bill.
          toast({ title: 'Product Identified', description: `${matches[0].productName} (${Math.round(matches[0].matchScore * 100)}% match). Please confirm before billing.` });
        } else {
          toast({ title: `Found ${matches.length} Match${matches.length > 1 ? 'es' : ''}`, description: `Best: ${matches[0]?.productName} (${Math.round(matches[0]?.matchScore * 100)}%)` });
        }
      } else {
        toast({ title: 'Analysis Failed', description: data?.error || 'Could not analyze image.', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('Image scan error:', err);
      toast({ title: 'Scan Error', description: err.message || 'Failed to analyze image.', variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  }, [captureFrame, toast]);

  const handleSelectMatch = (match: ImageMatch) => {
    if (match.product) {
      // Recognition only selects a candidate. POS performs product/variant/price confirmation.
      onProductFound?.(match.product as Product);
      handleClose();
    }
  };

  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    const localProduct = products.find(
      p => p.barcode === barcode || p.sku === barcode || p.ean_upc === barcode
    );

    if (localProduct) {
      onProductFound?.(localProduct);
      stopCamera();
      onClose();
      return;
    }

    setShowSuggestions(true);
    const result = await lookupBarcode(barcode, {
      includeMarketplaceData: true,
      searchSimilar: true,
    });

    if (result?.found && result.source === 'local' && result.product) {
      onProductFound?.(result.product as Product);
      stopCamera();
      onClose();
    } else {
      if (result?.aiSuggestions?.suggestions) setAiSuggestions(result.aiSuggestions.suggestions);
      if (result?.similarProducts) setSimilarProducts(result.similarProducts);
      toast({ title: 'Product Not Found', description: 'Check AI suggestions or add a new product' });
    }
  }, [products, lookupBarcode, onProductFound, onScan, stopCamera, onClose, toast]);

  // Barcode detection loop
  useEffect(() => {
    if (!isOpen || mode !== 'camera' || !isScanning || !hasBarcodeDetector) return;

    // @ts-ignore
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
          await handleBarcodeDetected(barcodes[0].rawValue);
          return;
        }
      } catch (err) {
        console.error('Barcode detection error:', err);
      }
      animationId = requestAnimationFrame(detectBarcode);
    };
    animationId = requestAnimationFrame(detectBarcode);
    return () => cancelAnimationFrame(animationId);
  }, [isOpen, mode, isScanning, hasBarcodeDetector, handleBarcodeDetected]);

  useEffect(() => {
    if (isOpen && (mode === 'camera' || mode === 'image')) {
      startCamera();
    }
    return () => stopCamera();
  }, [isOpen, mode, startCamera, stopCamera]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) await handleBarcodeDetected(manualBarcode.trim());
  };

  const handleSelectSimilarProduct = (product: Partial<Product>) => {
    if (product.id) {
      const fullProduct = products.find(p => p.id === product.id);
      if (fullProduct) {
        onProductFound?.(fullProduct);
        handleClose();
      }
    }
  };

  const handleClose = () => {
    stopCamera();
    setManualBarcode('');
    setShowSuggestions(false);
    setAiSuggestions(null);
    setSimilarProducts([]);
    setImageMatches([]);
    setImageAnalysis(null);
    setCapturedImage(null);
    setIsAnalyzing(false);
    onClose();
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (score >= 0.5) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5" />
            Visual Product Scanner
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'image' ? 'default' : 'outline'}
              onClick={() => { setMode('image'); setShowSuggestions(false); setImageMatches([]); setImageAnalysis(null); setCapturedImage(null); }}
              disabled={!hasCamera}
              className="flex-1"
              size="sm"
            >
              <Eye className="w-4 h-4 mr-1" />
              Image Scan
            </Button>
            <Button
              variant={mode === 'camera' ? 'default' : 'outline'}
              onClick={() => { setMode('camera'); setShowSuggestions(false); setImageMatches([]); setImageAnalysis(null); setCapturedImage(null); }}
              disabled={!hasCamera}
              className="flex-1"
              size="sm"
            >
              <ScanLine className="w-4 h-4 mr-1" />
              Barcode
            </Button>
            <Button
              variant={mode === 'manual' ? 'default' : 'outline'}
              onClick={() => { setMode('manual'); setShowSuggestions(false); setImageMatches([]); setImageAnalysis(null); setCapturedImage(null); }}
              className="flex-1"
              size="sm"
            >
              <Keyboard className="w-4 h-4 mr-1" />
              Manual
            </Button>
          </div>

          {/* Image Scan Results */}
          {(imageMatches.length > 0 || imageAnalysis) ? (
            <div className="space-y-3">
              {/* Analysis Summary */}
              {imageAnalysis && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                    AI Analysis
                    <Badge variant="outline" className="ml-auto text-xs">
                      {imageAnalysis.confidence} confidence
                    </Badge>
                  </h3>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Type:</strong> {imageAnalysis.productType}</p>
                    {imageAnalysis.colors?.length > 0 && (
                      <p><strong>Colors:</strong> {imageAnalysis.colors.join(', ')}</p>
                    )}
                    {imageAnalysis.style && <p><strong>Style:</strong> {imageAnalysis.style}</p>}
                    {imageAnalysis.textDetected && <p><strong>Text/Brand:</strong> {imageAnalysis.textDetected}</p>}
                    {imageAnalysis.material && <p><strong>Material:</strong> {imageAnalysis.material}</p>}
                  </div>
                </div>
              )}

              {/* Matched Products */}
              {imageMatches.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Search className="w-4 h-4" />
                    Matched Products
                  </h3>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {imageMatches.map((match, idx) => (
                        <button
                          key={match.productId || idx}
                          onClick={() => handleSelectMatch(match)}
                          className="w-full p-3 rounded-lg bg-secondary/50 hover:bg-secondary text-left flex items-center gap-3 transition-colors"
                        >
                          {match.product?.image_url ? (
                            <img
                              src={match.product.image_url}
                              alt={match.productName}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                              <Package className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{match.productName}</p>
                            <p className="text-xs text-muted-foreground">SKU: {match.sku}</p>
                            <p className="text-xs text-muted-foreground truncate">{match.matchReason}</p>
                          </div>
                          <Badge className={`text-xs shrink-0 ${getScoreColor(match.matchScore)}`}>
                            {Math.round(match.matchScore * 100)}%
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setImageMatches([]); setImageAnalysis(null); setCapturedImage(null); }}
                  className="flex-1"
                >
                  Scan Again
                </Button>
              </div>
            </div>
          ) : showSuggestions ? (
            <div className="space-y-4">
              {isLookingUp ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="ml-2">Looking up barcode...</span>
                </div>
              ) : (
                <>
                  {similarProducts.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                        <Search className="w-4 h-4" />
                        Similar Products Found
                      </h3>
                      <ScrollArea className="h-40">
                        <div className="space-y-2">
                          {similarProducts.map((product) => (
                            <button
                              key={product.id}
                              onClick={() => handleSelectSimilarProduct(product)}
                              className="w-full p-3 rounded-lg bg-secondary/50 hover:bg-secondary text-left flex items-center gap-3"
                            >
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded" />
                              ) : (
                                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                  <Package className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {aiSuggestions && (
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-primary" />
                        AI Suggestions
                      </h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiSuggestions}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowSuggestions(false)} className="flex-1">
                      Scan Again
                    </Button>
                    <Button onClick={() => handleBarcodeDetected(manualBarcode)} className="flex-1">
                      Add Manually
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : mode === 'image' ? (
            <div className="space-y-3">
              <div className="relative aspect-[4/3] bg-secondary rounded-lg overflow-hidden">
                {capturedImage ? (
                  <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-4 border-2 border-primary/40 rounded-lg" />
                      <div className="absolute bottom-4 left-0 right-0 text-center">
                        <span className="bg-background/80 px-3 py-1 rounded-full text-xs flex items-center justify-center gap-2 mx-auto w-fit">
                          <Eye className="w-3 h-3 text-primary" />
                          Point at a product and tap Identify
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
                    <span className="text-sm font-medium">AI analyzing product...</span>
                    <span className="text-xs text-muted-foreground mt-1">Checking type, color, style, design...</span>
                  </div>
                )}
              </div>
              <Button
                onClick={handleImageScan}
                disabled={isAnalyzing || !isScanning}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Identify Product with AI
                  </>
                )}
              </Button>
            </div>
          ) : mode === 'camera' ? (
            <div className="relative aspect-[4/3] bg-secondary rounded-lg overflow-hidden">
              {!hasBarcodeDetector ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                  <Camera className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Barcode scanning not supported in this browser. Try Chrome/Edge on Android.
                  </p>
                  <Button className="mt-4" onClick={() => setMode('manual')}>Use Manual Entry</Button>
                </div>
              ) : (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 border-2 border-primary/50" />
                    <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-primary animate-pulse" />
                  </div>
                  {isScanning && (
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <span className="bg-background/80 px-3 py-1 rounded-full text-xs flex items-center justify-center gap-2 mx-auto w-fit">
                        <ScanLine className="w-3 h-3 text-primary" />
                        Scanning for barcode...
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
              <Button type="submit" className="w-full" disabled={!manualBarcode.trim() || isLookingUp}>
                {isLookingUp ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Looking up...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Search with AI</>
                )}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
