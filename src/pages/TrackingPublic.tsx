import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Clock, Package } from 'lucide-react';
import logo from '@/assets/logo.png';
import { format } from 'date-fns';
import type { ShipmentStatus, StatusEvent } from '@/types/shipping';

const statusVariant = (status: ShipmentStatus) => {
  const map: Record<ShipmentStatus, 'secondary' | 'warning' | 'info' | 'default' | 'success' | 'destructive'> = {
    'Label Created': 'secondary', 'Received': 'warning', 'Shipped': 'info', 'Arrived in Destination': 'default',
    'Released by Customs': 'default', 'Ready for Delivery': 'warning', 'Delivered': 'success', 'Cancelled': 'destructive',
  };
  return map[status] ?? 'secondary';
};

const statusColor = (status: ShipmentStatus) => {
  const map: Record<ShipmentStatus, string> = {
    'Label Created': 'bg-muted-foreground',
    'Received': 'bg-warning',
    'Shipped': 'bg-info',
    'Arrived in Destination': 'bg-primary',
    'Released by Customs': 'bg-primary',
    'Ready for Delivery': 'bg-warning',
    'Delivered': 'bg-success',
    'Cancelled': 'bg-destructive',
  };
  return map[status] ?? 'bg-muted-foreground';
};

const TrackingPublic = () => {
  const { trackingCode } = useParams<{ trackingCode: string }>();
  const [search, setSearch] = useState(trackingCode || '');
  const [result, setResult] = useState<any>(null);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    setResult(null);
    setEvents([]);

    // Use secure RPC instead of direct table access
    const { data, error } = await supabase.rpc('get_tracking_info', {
      p_tracking_code: q.trim(),
    });

    if (!error && data) {
      const trackingData = data as any;
      if (trackingData?.shipment) {
        setResult(trackingData.shipment);
        setEvents(trackingData.events || []);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (trackingCode) doSearch(trackingCode);
  }, [trackingCode]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <img src={logo} alt="VeneExpress Shipping" className="h-8 w-8 object-contain" />
          <span className="font-bold font-heading text-lg">VeneExpress Shipping</span>
          <span className="text-muted-foreground text-sm ml-2">Track your shipment</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-10 h-12 text-lg font-mono-id"
                  placeholder="Enter your tracking code"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doSearch(search)}
                />
              </div>
              <Button className="h-12 px-6 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => doSearch(search)} disabled={loading}>
                Track
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        )}

        {searched && !loading && !result && (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No shipment found with that tracking code</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="font-heading font-mono-id">{result.shipment_id}</CardTitle>
                <Badge variant={statusVariant(result.status)} className="text-sm">{result.status}</Badge>
              </div>
              <CardDescription>
                {result.service_type === 'AIR' ? '✈️ Air Freight' : '🚢 Sea Freight'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <h3 className="font-heading font-semibold mb-4">Tracking History</h3>
              {events.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border" />
                  <div className="space-y-4">
                    {events.map((event, i) => (
                      <div key={event.id} className="flex gap-4 relative">
                        <div className={`h-6 w-6 rounded-full ${statusColor(event.status as ShipmentStatus)} shrink-0 flex items-center justify-center z-10 ${i === 0 ? 'ring-2 ring-offset-2 ring-offset-card ring-accent' : ''}`}>
                          <div className="h-2 w-2 rounded-full bg-card" />
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{event.status}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>
                          {event.note && <p className="text-sm text-muted-foreground mt-0.5">{event.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Last updated: {format(new Date(result.updated_at), 'MMM d, yyyy HH:mm')}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default TrackingPublic;
