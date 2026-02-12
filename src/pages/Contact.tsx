import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, Mail, MapPin } from 'lucide-react';
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
          <CardTitle className="font-heading">Get in Touch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <a href="tel:+1234567890" className="flex items-center gap-3 text-foreground hover:text-accent transition-colors">
            <Phone className="h-5 w-5 text-accent shrink-0" />
            <span>+1 (234) 567-890</span>
          </a>
          <a href="mailto:info@veneexpress.com" className="flex items-center gap-3 text-foreground hover:text-accent transition-colors">
            <Mail className="h-5 w-5 text-accent shrink-0" />
            <span>info@veneexpress.com</span>
          </a>
          <div className="flex items-start gap-3 text-foreground">
            <MapPin className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <span>Miami, FL, United States</span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default Contact;
