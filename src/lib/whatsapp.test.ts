import { describe, expect, it } from 'vitest';
import {
  buildCartMessage,
  buildPageMessage,
  buildProductIntentMessage,
  buildWhatsappUrl,
  formatWhatsappDisplay,
  resolveWhatsappNumber,
} from './whatsapp';

const product = {
  id: 'bike-1',
  slug: 'caloi-explorer-sport-2026',
  name: 'Caloi Explorer Sport 2026',
  price: 3499,
  stock: 2,
};

describe('WhatsApp click-to-chat', () => {
  it.each([
    ['availability', 'confirmar a disponibilidade'],
    ['quote', 'pedir um orçamento'],
    ['financing', 'parcelamento ou financiamento'],
    ['seller', 'falar com um vendedor'],
  ] as const)('cria mensagem de %s com produto, preço e origem', (intent, expectedCopy) => {
    const message = buildProductIntentMessage(product, intent);

    expect(message).toContain(expectedCopy);
    expect(message).toContain('*Produto:* Caloi Explorer Sport 2026');
    expect(message).toContain('*Preço:* R$ 3.499,00');
    expect(message).toContain('/produto/caloi-explorer-sport-2026');
  });

  it('troca disponibilidade por previsão de reposição quando está esgotado', () => {
    const message = buildProductIntentMessage({ ...product, stock: 0 }, 'availability');
    expect(message).toContain('previsão de reposição');
  });

  it('leva a origem do carrinho junto com os itens', () => {
    const message = buildCartMessage(
      [
        {
          product: {
            id: product.id,
            slug: product.slug,
            name: product.name,
            description: '',
            price: product.price,
            category: 'bicicletas',
            image: '',
            stock: product.stock,
          },
          quantity: 1,
        },
      ],
      {},
    );

    expect(message).toContain('Vim pelo carrinho do site');
    expect(message).toMatch(/\*Origem:\* .*\/carrinho/);
  });

  it('contextualiza o botão flutuante pela página', () => {
    expect(buildPageMessage('/produto/bike-1')).toContain('este produto');
    expect(buildPageMessage('/produtos', '?categoria=bicicletas')).toContain('catálogo');
    expect(buildPageMessage('/carrinho')).toContain('carrinho');
  });

  it('normaliza o número e codifica a mensagem no link wa.me', () => {
    const number = resolveWhatsappNumber('(31) 99532-6386');
    expect(number).toBe('5531995326386');
    expect(formatWhatsappDisplay(number)).toBe('(31) 99532-6386');
    expect(buildWhatsappUrl(number, 'Olá!')).toBe('https://wa.me/5531995326386?text=Ol%C3%A1!');
  });
});
