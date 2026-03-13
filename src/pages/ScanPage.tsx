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
import type { CameraDevice, Html5Qrcode as Html5QrcodeInstance } from 'html5-qrcode';
import type { Shipment, Box, ShipmentStatus } from '@/types/shipping';

const statusVariant = (status: ShipmentStatus) => {
  const map: Record<ShipmentStatus, 'secondary' | 'warning' | 'info' | 'default' | 'success' | 'destructive'> = {
    'Label Created': 'secondary', 'Received': 'warning', 'Shipped': 'info', 'Arrived in Destination': 'default',
    'Released by Customs': 'default', 'Ready for Delivery': 'warning', 'Delivered': 'success', 'Cancelled': 'destructive',
  };
  return map[status] ?? 'secondary';
};

const SCANNER_REGION_ID = 'shipment-scan-region';
const SCANNER_STATUS_READY = 'Camera scanner active. Align the barcode inside the frame.';
type ScanResult = Shipment & { customers: { first_name: string; last_name: string } };

const ScanPage = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const scanningRef = useRef(false);
  const html5QrCodeRef = useRef<Html5QrcodeInstance | null>(null);
  const [query, setQuery] = useState('');
  const [scanStatus, setScanStatus] = useState('');
  const [result, setResult] = useState<{ shipment: ScanResult; box?: Box } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
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

  const stopScanner = useCallback(async () => {
    scanningRef.current = false;
    const scanner = html5QrCodeRef.current;
    html5QrCodeRef.current = null;

    if (scanner) {
      try {
        await scanner.stop();
      } catch {
        // Ignore stop errors when the scanner never fully started.
      }

      try {
        scanner.clear();
      } catch {
        // Ignore clear errors when the region is already cleaned up.
      }
    }

    setScanning(false);
    setScanStatus('');
  }, []);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  const handleDetectedCode = useCallback(async (decodedText: string) => {
    const normalizedValue = normalizeLookupValue(decodedText);
    if (!normalizedValue || !scanningRef.current) return;

    const lookupCandidates = buildLookupCandidates(normalizedValue);
    const displayValue = lookupCandidates.digitsOnly || normalizedValue;

    toast.success(`Scanned: ${displayValue}`);
    setScanStatus('Barcode captured. Looking up record...');
    setQuery(displayValue);
    await stopScanner();
    await handleSearch(normalizedValue);
  }, [handleSearch, stopScanner]);

  const startScanner = async () => {
    try {
      if (scanningRef.current) return;

      scanningRef.current = true;
      setScanning(true);
      setScanStatus('Starting camera scanner...');

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

      const scanner = new Html5Qrcode(SCANNER_REGION_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
        ],
        // Keep the decoder path predictable across browsers for 1D shipping labels.
        useBarCodeDetectorIfSupported: false,
        verbose: false,
      });

      html5QrCodeRef.current = scanner;

      let cameraConfig: string | MediaTrackConstraints = { facingMode: { ideal: 'environment' } };
      let videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      };
      try {
        const cameras = await Html5Qrcode.getCameras();
        const rearCamera = cameras.find((camera: CameraDevice) =>
          /back|rear|environment/i.test(camera.label)
        );
        if (rearCamera) {
          cameraConfig = rearCamera.id;
          videoConstraints = {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          };
        } else if (cameras[0]) {
          cameraConfig = cameras[0].id;
          videoConstraints = {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          };
        }
      } catch {
        // Fall back to facingMode when camera enumeration is restricted.
      }

      await scanner.start(
        cameraConfig,
        {
          fps: 8,
          aspectRatio: 4 / 3,
          disableFlip: false,
          videoConstraints,
          qrbox: (viewfinderWidth, viewfinderHeight) => ({
            width: Math.floor(viewfinderWidth * 0.92),
            height: Math.max(90, Math.floor(viewfinderHeight * 0.22)),
          }),
        },
        (decodedText) => {
          void handleDetectedCode(decodedText);
        },
        () => {
          if (scanningRef.current) {
            setScanStatus(SCANNER_STATUS_READY);
          }
        }
      );

      setScanStatus(`${SCANNER_STATUS_READY} Optimized for VeneExpress box labels.`);
    } catch (err: unknown) {
      await stopScanner();
      const errorName = err instanceof Error ? err.name : '';
      const errorMessage = err instanceof Error ? err.message : '';
      if (errorName === 'NotAllowedError' || errorMessage.includes('Permission')) {
        toast.error('Camera permission denied. Please allow camera access.');
      } else {
        toast.error('Camera not available. Use manual input instead.');
      }
    }
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
                <div
                  id={SCANNER_REGION_ID}
                  className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
                />
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
