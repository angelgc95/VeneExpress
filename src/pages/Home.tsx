import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, Mail, LogIn } from 'lucide-react';
import logo from '@/assets/logo-optimized.webp';

const Home = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background relative px-4">
    <div className="flex flex-col items-center gap-10">
      <img src={logo} alt="VeneExpress" className="h-24 w-24 object-contain" />
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
