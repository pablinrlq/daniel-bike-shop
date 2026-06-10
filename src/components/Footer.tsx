import { Link } from 'react-router-dom';
import { MapPin, Phone, Instagram } from 'lucide-react';
import logo from '@/assets/logo.png';
import Newsletter from '@/components/Newsletter';
import { useNavCategories } from '@/hooks/useProducts';

const Footer = () => {
  const { data: navCategories } = useNavCategories();
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        {/* Newsletter Section */}
        <div className="mb-12">
          <Newsletter />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & About */}
          <div className="md:col-span-1">
            <img src={logo} alt="Daniel Bike Shop" className="h-16 w-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Sua loja especializada em bicicletas e peças de alta qualidade.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Navegação</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Início
                </Link>
              </li>
              <li>
                <Link to="/produtos" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Produtos
                </Link>
              </li>
              {(navCategories ?? []).map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/produtos?categoria=${cat.slug}`}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/favoritos" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Lista de Desejos
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & WhatsApp */}
          <div>
            <h4 className="font-semibold mb-4">Contato</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Belo Horizonte - MG</span>
              </li>
              <li>
                <a 
                  href="https://wa.me/5531995326386" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  <span>(31) 99532-6386</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Social - Only Instagram */}
          <div>
            <h4 className="font-semibold mb-4">Redes Sociais</h4>
            <div className="flex gap-4">
              <a 
                href="https://www.instagram.com/daniel_bike_shop/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                <Instagram className="h-6 w-6" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            © 2024 Daniel Bike Shop. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
