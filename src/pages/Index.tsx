import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import FeaturedProducts from '@/components/FeaturedProducts';
import CategorySection from '@/components/CategorySection';
import SEO from '@/components/SEO';
import { MapPin, Shield, HeadphonesIcon, CreditCard } from 'lucide-react';

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) || 'https://danielbikeshop.com';

const features = [
  {
    icon: CreditCard,
    title: '21x sem juros',
    description: 'Parcele sua bike no cartão'
  },
  {
    icon: Shield,
    title: 'Garantia',
    description: 'Todos os produtos com garantia'
  },
  {
    icon: HeadphonesIcon,
    title: 'Suporte',
    description: 'Atendimento especializado'
  },
  {
    icon: MapPin,
    title: 'Retire na loja',
    description: 'Belo Horizonte/MG'
  }
];

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO canonical={`${SITE_URL}/`} />
      <Header />
      <main id="main-content" className="flex-1">
        <HeroSection />

        {/* Features Bar */}
        <section className="border-y border-border bg-card" aria-label="Benefícios da loja">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-8">
              {features.map(feature => (
                <div key={feature.title} className="flex items-center gap-3">
                  <feature.icon className="h-8 w-8 text-primary flex-shrink-0" aria-hidden="true" />
                  <div>
                    <h4 className="font-semibold text-sm">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <FeaturedProducts />
        <CategorySection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
