import { MessageCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { buildWhatsappUrl, resolveWhatsappNumber } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

// Rotas onde o botão flutuante NÃO deve aparecer (admin e autenticação).
const HIDDEN_ROUTES = ['/login', '/cadastro'];

const WhatsAppButton = () => {
  const { pathname } = useLocation();
  const { data: settings } = useStoreSettings();

  // Some no painel admin e nas telas de login/cadastro. O React Router casa
  // rotas sem diferenciar maiúsculas e tolera barra final ('/Login/', '/ADMIN')
  // — normaliza antes de comparar pra não vazar o botão nessas variantes.
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (path.startsWith('/admin') || HIDDEN_ROUTES.includes(path)) {
    return null;
  }

  const whatsappNumber = resolveWhatsappNumber(settings?.whatsapp);
  const whatsappUrl = buildWhatsappUrl(whatsappNumber, 'Olá! Vim pelo site e quero uma ajuda.');

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "flex items-center justify-center",
        "w-14 h-14 rounded-full",
        "bg-[#25D366] hover:bg-[#20BA5A]",
        "text-white shadow-lg",
        "transition-all duration-300",
        "hover:scale-110 hover:shadow-xl",
        "animate-fade-in"
      )}
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />

      {/* Pulse animation */}
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-25" />
    </a>
  );
};

export default WhatsAppButton;
