import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Mail, LogIn, Calculator } from 'lucide-react';
import logo from '@/assets/logo-optimized.webp';
import type { PricingRule } from '@/types/shipping';

const PricingEstimator = () => {
  const [dims, setDims] = useState({ length: '', width: '', height: '' });

  const { data: pricingRule } = useQuery({
    queryKey: ['pricing-rule-public', 'SEA'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pricing_rules')
        .select('*')
        .eq('service_type', 'SEA')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PricingRule | null;
    },
  });

  const rate = pricingRule ? parseFloat(String(pricingRule.rate_per_ft3)) : 25;

  const l = parseFloat(dims.length);
  const w = parseFloat(dims.width);
  const h = parseFloat(dims.height);
  const valid = !isNaN(l) && !isNaN(w) && !isNaN(h) && l > 0 && w > 0 && h > 0;
  const volume = valid ? (l * w * h) / 1728 : 0;
  const price = Math.round(volume * rate * 100) / 100;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Pricing Estimator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">L (in)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              value={dims.length}
              onChange={(e) => setDims(d => ({ ...d, length: e.target.value }))}
            />
          </div>
          <span className="text-muted-foreground pb-2">×</span>
          <div className="space-y-1 flex-1">
            <Label className="text-xs">W (in)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              value={dims.width}
              onChange={(e) => setDims(d => ({ ...d, width: e.target.value }))}
            />
          </div>
          <span className="text-muted-foreground pb-2">×</span>
          <div className="space-y-1 flex-1">
            <Label className="text-xs">H (in)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              value={dims.height}
              onChange={(e) => setDims(d => ({ ...d, height: e.target.value }))}
            />
          </div>
        </div>
        {valid && (
          <div className="text-sm text-muted-foreground bg-muted rounded-lg p-3 text-center">
            {volume.toFixed(2)} ft³ × ${rate}/ft³ ={' '}
            <span className="text-lg font-semibold text-foreground">${price.toFixed(2)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Home = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background relative px-4">
    <div className="flex flex-col items-center gap-8">
      <img src={logo} alt="VeneExpress" className="h-72 w-72 object-contain" />
      <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
        VeneExpress
      </h1>
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-md">
        <Button asChild size="lg" className="flex-1 gap-2">
          <Link to="/contact">
            <Mail className="h-5 w-5" />
            Contact Us
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="flex-1 gap-2">
          <Link to="/track">
            <Package className="h-5 w-5" />
            Track Your Package
          </Link>
        </Button>
      </div>
      <PricingEstimator />
    </div>

    <div className="absolute bottom-6 left-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
        <Link to="/auth">
          <LogIn className="h-4 w-4" />
          Admin Panel
        </Link>
      </Button>
    </div>
  </div>
);

export default Home;
