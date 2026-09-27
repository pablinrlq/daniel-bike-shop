import type { CartItem } from '@/types/product';
import type { User } from '@supabase/supabase-js';

const FALLBACK_WHATSAPP = '5531995326386'; // (31) 99532-6386

const formatPrice = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D+/g, '');

export const resolveWhatsappNumber = (raw: string | null | undefined): string => {
  const digits = onlyDigits(raw);
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 ? digits : FALLBACK_WHATSAPP;
};

export const formatWhatsappDisplay = (raw: string | null | undefined): string => {
  const resolved = resolveWhatsappNumber(raw);
  const local = resolved.startsWith('55') ? resolved.slice(2) : resolved;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return raw || resolved;
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

export interface ProductLite {
  id: string;
  slug?: string | null;
  name: string;
  price: number;
  stock?: number;
}

export type ProductWhatsappIntent = 'availability' | 'quote' | 'financing' | 'seller';

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

const productBlock = (product: ProductLite): string[] => {
  const url = buildOriginUrl(`/produto/${product.slug || product.id}`);
  return [
    `*Produto:* ${product.name}`,
    `*Preço:* ${formatPrice(product.price)}`,
    `*Link:* ${url}`,
  ];
};

const intentCopy: Record<ProductWhatsappIntent, (product: ProductLite) => string[]> = {
  availability: (product) => [
    product.stock === 0
      ? 'Olá! Vi este produto no site e gostaria de saber a previsão de reposição:'
      : 'Olá! Vi este produto no site e gostaria de confirmar a disponibilidade:',
    '',
    ...productBlock(product),
    '',
    product.stock === 0
      ? 'Quando ele deve voltar ao estoque?'
      : 'Está disponível para retirada ou entrega? Qual é o prazo?',
  ],
  quote: (product) => [
    'Olá! Gostaria de pedir um orçamento para este produto:',
    '',
    ...productBlock(product),
    '',
    'Pode me enviar o valor final e as opções de entrega ou retirada?',
  ],
  financing: (product) => [
    'Olá! Gostaria de saber as opções de parcelamento ou financiamento deste produto:',
    '',
    ...productBlock(product),
    '',
    'Quais condições estão disponíveis? Se precisar, envio meus dados diretamente por aqui.',
  ],
  seller: (product) => [
    'Olá! Quero falar com um vendedor sobre este produto:',
    '',
    ...productBlock(product),
    '',
    'Pode me ajudar?',
  ],
};

/** Mensagem de produto com uma intenção explícita para agilizar o atendimento. */
export const buildProductIntentMessage = (
  product: ProductLite,
  intent: ProductWhatsappIntent,
  contact: UserContact = {},
): string => {
  const lines = intentCopy[intent](product);
  lines.splice(lines.length - 1, 0, ...contactBlock(contact));
  return lines.join('\n');
};

/** Compatibilidade com os pontos antigos que usam a ação genérica de produto. */
export const buildProductMessage = (product: ProductLite, contact: UserContact): string =>
  buildProductIntentMessage(product, 'seller', contact);

/** Mensagem para o carrinho cheio. */
export const buildCartMessage = (items: CartItem[], contact: UserContact): string => {
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const lines = ['Olá! Vim pelo carrinho do site e quero finalizar a compra destes produtos:', ''];
  items.forEach((item, index) => {
    lines.push(`${index + 1}. *${item.product.name}*`);
    lines.push(
      `   ${item.quantity} x ${formatPrice(item.product.price)} = ${formatPrice(
        item.product.price * item.quantity,
      )}`,
    );
  });
  lines.push('', `*Subtotal: ${formatPrice(subtotal)}*`);
  lines.push(`*Origem:* ${buildOriginUrl('/carrinho')}`);
  if (contact.name) lines.push('', `*Cliente:* ${contact.name}`);
  lines.push('', 'Como combinamos o pagamento e a entrega?');
  return lines.join('\n');
};

export const buildWhatsappUrl = (number: string, message: string): string =>
  `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

/** Mensagem contextual do botão flutuante, conforme a página em que o cliente está. */
export const buildPageMessage = (pathname: string, search = ''): string => {
  const pageUrl = buildOriginUrl(`${pathname}${search}`);

  if (pathname.startsWith('/produto/')) {
    return ['Olá! Estou vendo este produto no site:', pageUrl, '', 'Pode me ajudar com ele?'].join('\n');
  }
  if (pathname === '/produtos') {
    return [
      'Olá! Estou navegando pelo catálogo da Daniel Bike Shop e quero ajuda para escolher.',
      pageUrl,
      '',
      'Posso contar o que estou procurando?',
    ].join('\n');
  }
  if (pathname === '/carrinho') {
    return ['Olá! Estou no carrinho do site e preciso de ajuda para concluir minha compra.', pageUrl].join('\n');
  }

  return ['Olá! Vim pelo site da Daniel Bike Shop e quero uma ajuda.', pageUrl].join('\n');
};
