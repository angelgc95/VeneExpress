import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, Mail, MapPin, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import logo from '@/assets/logo.png';

const Contact = () => (
  <div className="min-h-screen bg-background flex flex-col items-center px-4 py-12">
    <div className="w-full max-w-lg space-y-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <img src={logo} alt="VeneExpress" className="h-8 w-8 object-contain" />
        <h1 className="text-2xl font-heading font-bold text-foreground">Contact Us</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">VeneExpress Katy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3 text-foreground">
            <MapPin className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <span>21110 N Summitry Cir, Katy, TX 77449, Texas</span>
          </div>
          <a href="tel:8017591022" className="flex items-center gap-3 text-foreground hover:text-accent transition-colors">
            <Phone className="h-5 w-5 text-accent shrink-0" />
            <span>8017591022</span>
          </a>
          <a href="mailto:venexpresshipping@hotmail.com" className="flex items-center gap-3 text-foreground hover:text-accent transition-colors">
            <Mail className="h-5 w-5 text-accent shrink-0" />
            <span>venexpresshipping@hotmail.com</span>
          </a>
          <a
            href="https://maps.app.goo.gl/5pto1wnZBqt7baJD8?g_st=aw"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="w-full gap-2 mt-2">
              <ExternalLink className="h-4 w-4" />
              Open in Google Maps
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default Contact;
