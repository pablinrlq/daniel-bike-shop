import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Menu, X, Search, Heart, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import logo from '@/assets/logo.png';
import SearchBar from '@/components/SearchBar';

const Header = () => {
  const { itemCount } = useCart();
  const { wishlistCount } = useWishlist();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Início', path: '/' },
    { name: 'Bicicletas', path: '/produtos?categoria=bicicletas' },
    { name: 'Peças', path: '/produtos?categoria=pecas' },
    { name: 'Acessórios', path: '/produtos?categoria=acessorios' },
    { name: 'Sobre', path: '/sobre' },
  ];

  const isActive = (path: string) => {
    const [targetPath, targetQuery] = path.split('?');
    if (targetPath === '/') return location.pathname === '/';

    const currentPath = location.pathname;
    const onSamePath =
      currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
    if (!onSamePath) return false;

    if (!targetQuery) return true;
    const targetParams = new URLSearchParams(targetQuery);
    const currentParams = new URLSearchParams(location.search);
    for (const [key, value] of targetParams) {
      if (currentParams.get(key) !== value) return false;
    }
    return true;
  };

  // Fecha menu mobile ao trocar de rota
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  // ESC fecha menu mobile
  useEffect(() => {
    if (!mobileMenuOpen && !searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen, searchOpen]);

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border" role="banner">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link to="/" className="flex items-center gap-2" aria-label="Daniel Bike Shop — página inicial">
            <img
              src={logo}
              alt="Daniel Bike Shop"
              width={64}
              height={64}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="h-12 md:h-16 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Navegação principal">
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                aria-current={isActive(link.path) ? 'page' : undefined}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive(link.path) ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop Search */}
            <div className="hidden lg:block w-64">
              <SearchBar />
            </div>

            {/* Mobile Search Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label={searchOpen ? 'Fechar busca' : 'Abrir busca'}
              aria-expanded={searchOpen}
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Button>

            {/* Account */}
            <Link
              to={user ? '/conta' : '/login'}
              aria-label={user ? 'Minha conta' : 'Entrar na minha conta'}
            >
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Link>

            {/* Wishlist */}
            <Link
              to="/favoritos"
              className="relative"
              aria-label={`Lista de favoritos${wishlistCount > 0 ? ` (${wishlistCount} itens)` : ''}`}
            >
              <Button variant="ghost" size="icon">
                <Heart className="h-5 w-5" aria-hidden="true" />
                {wishlistCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    {wishlistCount}
                  </span>
                )}
              </Button>
            </Link>

            <Link
              to="/carrinho"
              className="relative"
              aria-label={`Carrinho de compras${itemCount > 0 ? ` (${itemCount} itens)` : ''}`}
            >
              <Button variant="ghost" size="icon">
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                {itemCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        {searchOpen && (
          <div className="lg:hidden py-3 border-t border-border">
            <SearchBar onClose={() => setSearchOpen(false)} />
          </div>
        )}

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav
            id="mobile-nav"
            className="md:hidden py-4 border-t border-border"
            aria-label="Navegação mobile"
          >
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive(link.path) ? 'page' : undefined}
                className={`block py-3 text-sm font-medium transition-colors hover:text-primary ${
                  isActive(link.path) ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
