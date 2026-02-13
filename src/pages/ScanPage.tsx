import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScanLine, Package, ArrowRight, Camera, X } from 'lucide-react';
import type { Shipment, Box, ShipmentStatus } from '@/types/shipping';

const statusVariant = (status: ShipmentStatus) => {
  const map: Record<ShipmentStatus, 'secondary' | 'warning' | 'info' | 'default' | 'success' | 'destructive'> = {
    'Label Created': 'secondary', 'Received': 'warning', 'Shipped': 'info', 'Arrived in Destination': 'default',
    'Released by Customs': 'default', 'Ready for Delivery': 'warning', 'Delivered': 'success', 'Cancelled': 'destructive',
  };
  return map[status] ?? 'secondary';
};

const ScanPage = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<any>(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{
    shipment: Shipment & { customers: { first_name: string; last_name: string } };
    box?: Box;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {}
        scannerRef.current = null;
      }
    };
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    q = q.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);

    try {
      // Try as box ID first
      const { data: box } = await (supabase as any)
        .from('boxes')
        .select('*')
        .eq('box_id', q)
        .maybeSingle();

      if (box) {
        const { data: shipment } = await (supabase as any)
          .from('shipments')
          .select('*, customers(first_name, last_name)')
          .eq('id', box.shipment_id)
          .single();
        if (shipment) {
          setResult({ shipment, box });
          setLoading(false);
          return;
        }
      }

      // Try as shipment ID
      const { data: shipment } = await (supabase as any)
        .from('shipments')
        .select('*, customers(first_name, last_name)')
        .eq('shipment_id', q)
        .maybeSingle();

      if (shipment) {
        setResult({ shipment });
      } else {
        toast.error('No shipment or box found');
      }
    } catch (e) {
      toast.error('Search failed');
    }
    setLoading(false);
  }, []);

  const startScanner = async () => {
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      
      setScanning(true);

      // Wait for DOM element to render
      await new Promise(r => setTimeout(r, 300));

      const scanRegion = document.getElementById('scanner-region');
      if (!scanRegion) {
        throw new Error('Scanner region not found');
      }

      const html5QrCode = new Html5Qrcode('scanner-region', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 280, height: 120 }, aspectRatio: 1.333 },
        (decodedText: string) => {
          setQuery(decodedText);
          stopScanner();
          handleSearch(decodedText);
        },
        () => {} // ignore errors during scanning
      );
    } catch (err: any) {
      setScanning(false);
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
        toast.error('Camera permission denied. Please allow camera access.');
      } else {
        toast.error('Camera not available. Use manual input instead.');
      }
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().catch(() => {});
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold font-heading">Scan / Search</h1>
        <p className="text-muted-foreground text-sm">Scan a barcode or type a Shipment/Box ID</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                className="pl-11 h-14 text-lg font-mono-id"
                placeholder="Scan or type ID..."
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
              <div className="relative rounded-lg overflow-hidden bg-black">
                <div id="scanner-region" className="w-full" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background z-10"
                  onClick={stopScanner}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">Point camera at barcode</p>
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
