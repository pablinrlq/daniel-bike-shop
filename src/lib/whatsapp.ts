import type { CartItem } from '@/types/product';
import type { User } from '@supabase/supabase-js';

const FALLBACK_WHATSAPP = '5531995326386'; // (31) 99532-6386

const formatPrice = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D+/g, '');

export const resolveWhatsappNumber = (raw: string | null | undefined): string => {
  const digits = onlyDigits(raw);
  return digits.length >= 10 ? digits : FALLBACK_WHATSAPP;
};

interface UserContact {
  name?: string;
  email?: string;
  phone?: string;
}

export const userToContact = (user: User | null | undefined): UserContact => {
  if (!user) return {};
  const metadata = (user.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
    phone?: string;
  };
  return {
    name: metadata.full_name || metadata.name,
    email: user.email ?? undefined,
    phone: metadata.phone,
  };
};

const buildOriginUrl = (path: string) => {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
};

interface ProductLite {
  id: string;
  slug?: string | null;
  name: string;
  price: number;
}

const contactBlock = (contact: UserContact): string[] => {
  const lines: string[] = [];
  const fields = [
    contact.name && `Nome: ${contact.name}`,
    contact.email && `E-mail: ${contact.email}`,
    contact.phone && `Telefone: ${contact.phone}`,
  ].filter(Boolean) as string[];
  if (fields.length === 0) return lines;
  lines.push('', '*Meus dados:*');
  lines.push(...fields);
  return lines;
};

/** Mensagem para "Quero esse produto" (1 produto). */
export const buildProductMessage = (product: ProductLite, contact: UserContact): string => {
  const url = buildOriginUrl(`/produto/${product.slug || product.id}`);
  const lines = [
    'Olá! Tenho interesse neste produto:',
    '',
    `🚲 *${product.name}*`,
    `💰 ${formatPrice(product.price)}`,
    `🔗 ${url}`,
    ...contactBlock(contact),
    '',
    'Pode me ajudar?',
  ];
  return lines.join('\n');
};

/** Mensagem para o carrinho cheio. */
export const buildCartMessage = (items: CartItem[], contact: UserContact): string => {
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const lines = ['Olá! Quero finalizar a compra destes produtos:', ''];
  items.forEach((item, index) => {
    lines.push(`${index + 1}. *${item.product.name}*`);
    lines.push(
      `   ${item.quantity} x ${formatPrice(item.product.price)} = ${formatPrice(
        item.product.price * item.quantity,
      )}`,
    );
  });
  lines.push('', `*Subtotal: ${formatPrice(subtotal)}*`);
  lines.push(...contactBlock(contact));
  lines.push('', 'Como combinamos o pagamento e a entrega?');
  return lines.join('\n');
};

export const buildWhatsappUrl = (number: string, message: string): string =>
  `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
