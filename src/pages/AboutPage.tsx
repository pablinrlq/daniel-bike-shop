import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { Bike, Users, Award, Heart, MapPin, Phone, Mail, Clock, Camera } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import SEO from '@/components/SEO';
import heroBike from '@/assets/hero-bike.jpg';

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) || 'https://danielbikeshop.com';

// Fotos da loja. Coloque os arquivos em public/sobre/ com estes nomes
// (ex.: public/sobre/loja-1.jpg). Enquanto não existirem, aparece uma
// "plaquinha" elegante no lugar — o layout nunca quebra.
const STORE_PHOTOS = [
  { src: '/sobre/loja-1.jpg', caption: 'Nossa loja' },
  { src: '/sobre/loja-2.jpg', caption: 'Showroom de bikes' },
  { src: '/sobre/loja-3.jpg', caption: 'Oficina' },
  { src: '/sobre/loja-4.jpg', caption: 'Acessórios' },
  { src: '/sobre/loja-5.jpg', caption: 'Atendimento' },
  { src: '/sobre/loja-6.jpg', caption: 'Equipe' },
];

const GalleryTile = ({ src, caption }: { src: string; caption: string }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-card">
      {!failed ? (
        <img
          src={src}
          alt={caption}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-card to-card text-muted-foreground">
          <Camera className="h-8 w-8 text-primary/60" />
          <span className="text-xs uppercase tracking-wider">Foto em breve</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/80 to-transparent p-3">
        <span className="text-sm font-medium">{caption}</span>
      </div>
    </div>
  );
};

const AboutPage = () => {
  const { data: settings, isLoading } = useStoreSettings();
  const storeName = settings?.store_name || 'Daniel Bike Shop';

  // Só mostra na galeria as fotos que REALMENTE existem em public/sobre/.
  // Sem foto, a seção inteira some (nada de "FOTO EM BREVE").
  const [availablePhotos, setAvailablePhotos] = useState<typeof STORE_PHOTOS>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      STORE_PHOTOS.map(
        (p) =>
          new Promise<(typeof STORE_PHOTOS)[number] | null>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(p);
            img.onerror = () => resolve(null);
            img.src = p.src;
          }),
      ),
    ).then((res) => {
      if (!cancelled) {
        setAvailablePhotos(res.filter((p): p is (typeof STORE_PHOTOS)[number] => p !== null));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Sobre a loja"
        description="Conheça a Daniel Bike Shop — bicicletas, peças, acessórios e oficina em Belo Horizonte/MG."
        canonical={`${SITE_URL}/sobre`}
      />
      <Header />
      <main id="main-content" className="flex-1">
        {/* Hero com imagem de fundo */}
        <section className="relative py-24 md:py-32 overflow-hidden">
          <img
            src={heroBike}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <span className="text-sm text-primary uppercase tracking-[0.2em] font-semibold">Sobre Nós</span>
              <h1 className="text-4xl md:text-6xl font-bold mt-3 mb-6">{storeName}</h1>
              <p className="text-lg md:text-xl text-muted-foreground">
                Paixão por bike em Belo Horizonte. Bicicletas, peças, acessórios e oficina —
                com atendimento de quem entende e pedala.
              </p>
            </div>
          </div>
        </section>

        {/* Valores */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
              {[
                { icon: Bike, title: 'Qualidade', description: 'Marcas líderes como Oggi, Shimano e Absolute' },
                { icon: Users, title: 'Atendimento', description: 'Equipe que pedala e entende do assunto' },
                { icon: Award, title: 'Oficina', description: 'Manutenção e montagem feitas por especialistas' },
                { icon: Heart, title: 'Paixão', description: 'Amamos bike — e isso reflete em cada detalhe' },
              ].map((value, index) => (
                <div
                  key={value.title}
                  className="text-center p-6 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-lg transition-all animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                    <value.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                  <p className="text-muted-foreground text-sm">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Galeria da loja — só aparece quando há fotos reais em public/sobre/ */}
        {availablePhotos.length > 0 && (
          <section className="py-16 bg-card">
            <div className="container mx-auto px-4">
              <div className="text-center mb-12">
                <span className="text-sm text-muted-foreground uppercase tracking-wider">Galeria</span>
                <h2 className="text-3xl md:text-4xl font-bold mt-2">Conheça nosso espaço</h2>
                <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
                  Um pedacinho da loja, da oficina e da nossa equipe.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5 max-w-5xl mx-auto">
                {availablePhotos.map((photo) => (
                  <GalleryTile key={photo.src} src={photo.src} caption={photo.caption} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* História */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-8">Nossa História</h2>
              <div className="prose prose-lg mx-auto text-muted-foreground">
                <p className="mb-4">
                  A {storeName} nasceu da paixão pelo ciclismo e do desejo de oferecer aos ciclistas
                  produtos de qualidade com preço justo, em Belo Horizonte/MG.
                </p>
                <p className="mb-4">
                  Ao longo dos anos construímos uma reputação sólida, baseada em confiança, qualidade
                  e atendimento personalizado. Nossa equipe é formada por entusiastas que entendem a
                  necessidade de cada cliente — do iniciante ao profissional.
                </p>
                <p>
                  Hoje oferecemos bicicletas, peças e acessórios das melhores marcas, além de uma
                  oficina completa para manutenção e montagem. Venha nos visitar!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contato */}
        <section className="py-16 bg-card">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">Entre em Contato</h2>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {settings?.address && (
                  <div className="flex items-start gap-4 p-4 bg-background border border-border rounded-lg">
                    <MapPin className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Endereço</h4>
                      <p className="text-sm text-muted-foreground">
                        {settings.address}
                        {settings.city && `, ${settings.city}`}
                        {settings.state && ` - ${settings.state}`}
                      </p>
                    </div>
                  </div>
                )}
                {settings?.contact_phone && (
                  <div className="flex items-start gap-4 p-4 bg-background border border-border rounded-lg">
                    <Phone className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Telefone</h4>
                      <p className="text-sm text-muted-foreground">{settings.contact_phone}</p>
                    </div>
                  </div>
                )}
                {settings?.contact_email && (
                  <div className="flex items-start gap-4 p-4 bg-background border border-border rounded-lg">
                    <Mail className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">E-mail</h4>
                      <p className="text-sm text-muted-foreground">{settings.contact_email}</p>
                    </div>
                  </div>
                )}
                {settings?.working_hours && (
                  <div className="flex items-start gap-4 p-4 bg-background border border-border rounded-lg">
                    <Clock className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Horário</h4>
                      <p className="text-sm text-muted-foreground">{settings.working_hours}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AboutPage;
