import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ScanLine, Package, ArrowRight, Camera, X } from 'lucide-react';
import {
  buildLookupCandidates,
  getBoxScanCodeFromId,
  getShipmentScanCodeFromId,
  normalizeLookupValue,
} from '@/lib/scan-codes';
import type { Shipment, Box, ShipmentStatus } from '@/types/shipping';

const statusVariant = (status: ShipmentStatus) => {
  const map: Record<ShipmentStatus, 'secondary' | 'warning' | 'info' | 'default' | 'success' | 'destructive'> = {
    'Label Created': 'secondary', 'Received': 'warning', 'Shipped': 'info', 'Arrived in Destination': 'default',
    'Released by Customs': 'default', 'Ready for Delivery': 'warning', 'Delivered': 'success', 'Cancelled': 'destructive',
  };
  return map[status] ?? 'secondary';
};

// Check if native BarcodeDetector is available
const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
type ScanResult = Shipment & { customers: { first_name: string; last_name: string } };
type DetectedBarcode = { rawValue?: string; format?: string };
type BarcodeDetectorLike = {
  detect: (input: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

const ScanPage = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const animFrameRef = useRef<number>(0);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const [query, setQuery] = useState('');
  const [scanStatus, setScanStatus] = useState('');
  const [result, setResult] = useState<{ shipment: ScanResult; box?: Box } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleSearch = useCallback(async (rawQuery: string) => {
    const normalizedQuery = normalizeLookupValue(rawQuery);
    if (!normalizedQuery) return;

    setQuery(normalizedQuery);
    setLoading(true);
    setResult(null);

    try {
      const { boxIds, shipmentIds } = buildLookupCandidates(normalizedQuery);
      const boxSearchValues = [...new Set([normalizedQuery, ...boxIds])];
      const shipmentSearchValues = [...new Set([normalizedQuery, ...shipmentIds])];

      if (boxSearchValues.length > 0) {
        const { data: boxes, error: boxError } = await supabase
          .from('boxes')
          .select('*')
          .in('box_id', boxSearchValues)
          .limit(1);

        if (boxError) throw boxError;

        const box = boxes?.[0];
        if (box) {
          const { data: shipment, error: shipmentError } = await supabase
            .from('shipments')
            .select('*, customers(first_name, last_name)')
            .eq('id', box.shipment_id)
            .single();

          if (shipmentError) throw shipmentError;

          if (shipment) {
            setResult({ shipment, box });
            return;
          }
        }
      }

      if (shipmentSearchValues.length > 0) {
        const { data: shipments, error: shipmentError } = await supabase
          .from('shipments')
          .select('*, customers(first_name, last_name)')
          .in('shipment_id', shipmentSearchValues)
          .limit(1);

        if (shipmentError) throw shipmentError;

        const shipment = shipments?.[0];
        if (shipment) {
          setResult({ shipment });
          return;
        }
      }

      toast.error('No shipment or box found');
    } catch (e) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const resultScanCode = result?.box
    ? getBoxScanCodeFromId(result.box.box_id)
    : result
      ? getShipmentScanCodeFromId(result.shipment.shipment_id)
      : null;

  const startScanner = async () => {
    try {
      scanningRef.current = true;
      setScanning(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      // Wait for video element to render
      await new Promise(r => setTimeout(r, 100));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (hasBarcodeDetector) {
        const BarcodeDetectorCtor = (window as Window & typeof globalThis & {
          BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
        }).BarcodeDetector;

        setScanStatus('Using native scanner...');
        console.log('[Scanner] Using native BarcodeDetector');
        detectorRef.current = BarcodeDetectorCtor
          ? new BarcodeDetectorCtor({
              formats: ['code_128', 'code_39', 'ean_13', 'qr_code'],
            })
          : null;
        detectLoop();
      } else {
        setScanStatus('Using fallback scanner...');
        console.log('[Scanner] BarcodeDetector not available, using fallback');
        startHtml5QrcodeFallback();
      }
    } catch (err: unknown) {
      stopScanner();
      const errorName = err instanceof Error ? err.name : '';
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorName === 'NotAllowedError' || errorMessage.includes('Permission')) {
        toast.error('Camera permission denied. Please allow camera access.');
      } else {
        toast.error('Camera not available. Use manual input instead.');
      }
    }
  };

  const detectLoop = () => {
    if (!videoRef.current || !detectorRef.current) return;
    let frameCount = 0;

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || !detectorRef.current) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        frameCount++;
        if (frameCount % 30 === 0) {
          console.log(`[Scanner] Scanned ${frameCount} frames, no detection yet`);
          setScanStatus(`Scanning... (${frameCount} frames)`);
        }
        if (barcodes.length > 0) {
          const value = barcodes[0].rawValue;
          console.log('[Scanner] Detected:', value, 'format:', barcodes[0].format);
          if (value) {
            toast.success(`Scanned: ${value}`);
            setScanStatus('Barcode captured. Looking up record...');
            setQuery(normalizeLookupValue(value));
            stopScanner();
            handleSearch(value);
            return;
          }
        }
      } catch (err) {
        console.error('[Scanner] Detection error:', err);
      }
      animFrameRef.current = requestAnimationFrame(detect);
    };
    animFrameRef.current = requestAnimationFrame(detect);
  };

  const startHtml5QrcodeFallback = async () => {
    // Fallback for browsers without BarcodeDetector (e.g. Firefox)
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

      // Create a hidden element for html5-qrcode
      const el = document.createElement('div');
      el.id = 'qr-fallback-region';
      el.style.display = 'none';
      document.body.appendChild(el);

      const scanner = new Html5Qrcode('qr-fallback-region', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      // Scan from video frames using canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const scanFrame = async () => {
        if (!videoRef.current || !scanningRef.current) return;
        const video = videoRef.current;
        if (video.readyState < 2) {
          animFrameRef.current = requestAnimationFrame(scanFrame);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        try {
          const result = await scanner.scanFileV2(
            new File([await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/png'))], 'frame.png'),
            false
          );
          if (result?.decodedText) {
            setScanStatus('Barcode captured. Looking up record...');
            setQuery(normalizeLookupValue(result.decodedText));
            stopScanner();
            handleSearch(result.decodedText);
            el.remove();
            return;
          }
        } catch {
          // Keep scanning frames until a readable barcode is found.
        }
        setTimeout(() => {
          animFrameRef.current = requestAnimationFrame(scanFrame);
        }, 200); // scan every 200ms for fallback
      };
      animFrameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      toast.error('Scanner not supported on this browser.');
    }
  };

  const stopScanner = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    detectorRef.current = null;
    scanningRef.current = false;
    setScanning(false);
    setScanStatus('');
    // Cleanup fallback element
    document.getElementById('qr-fallback-region')?.remove();
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold font-heading">Scan / Search</h1>
        <p className="text-muted-foreground text-sm">Scan a barcode or type a shipment ID, box ID, or manual scan code</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-entry">Manual entry</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="manual-entry"
                  ref={inputRef}
                  className="pl-11 h-14 text-lg font-mono-id"
                  placeholder="Enter scan code, shipment ID, or box ID"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                  autoFocus
                />
              </div>
              <Button className="h-14 px-6 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => handleSearch(query)} disabled={loading}>
                {loading ? '...' : 'Go'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use the printed numeric scan code if the camera or barcode scanner misses the label.
            </p>
          </div>

          {!scanning ? (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={startScanner}
            >
              <Camera className="h-4 w-4" />
              Scan with Camera
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                {/* Scan guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[75%] h-[35%] border-2 border-white/70 rounded-md" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background z-10"
                  onClick={stopScanner}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {scanStatus || 'Point camera at barcode'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading font-mono-id">{result.shipment.shipment_id}</CardTitle>
              <Badge variant={statusVariant(result.shipment.status as ShipmentStatus)}>{result.shipment.status}</Badge>
            </div>
            <CardDescription>
              {result.shipment.customers?.first_name} {result.shipment.customers?.last_name}
              {' • '}{result.shipment.service_type}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resultScanCode && (
              <div className="p-3 border rounded-lg">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Manual scan code</p>
                <p className="text-sm font-mono-id">{resultScanCode}</p>
              </div>
            )}
            {result.box && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Box: <span className="font-mono-id">{result.box.box_id}</span></p>
                <p className="text-sm text-muted-foreground">
                  {parseFloat(String(result.box.length_in))} × {parseFloat(String(result.box.width_in))} × {parseFloat(String(result.box.height_in))} in
                  {' • '}{parseFloat(String(result.box.volume_ft3)).toFixed(2)} ft³
                  {' • '}${parseFloat(String(result.box.final_price)).toFixed(2)}
                </p>
              </div>
            )}
            <Button
              className="w-full"
              onClick={() => navigate(`/shipments/${result.shipment.id}`)}
            >
              <Package className="h-4 w-4 mr-2" /> View Shipment <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScanPage;
