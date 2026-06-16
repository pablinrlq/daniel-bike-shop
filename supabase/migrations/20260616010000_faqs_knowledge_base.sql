-- FAQ / base de conhecimento do atendente de IA
-- Perguntas e respostas que a IA usa para responder dúvidas que não são de
-- catálogo (frete, troca, garantia, pagamento, loja física, etc.).
-- A edge function whatsapp-webhook injeta as FAQs ativas no system prompt
-- (que é cacheado) — assim a IA responde rápido e sem chute, sem custo de
-- busca semântica. Para uma base grande (manuais, centenas de docs), dá para
-- migrar para busca vetorial com pgvector — ver docs/analise-daniel-bike-shop.md.

CREATE TABLE public.faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ler FAQs ativas (útil para uma página de FAQ no site também).
CREATE POLICY "Anyone can view active faqs"
  ON public.faqs FOR SELECT
  USING (is_active = true OR public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can insert faqs"
  ON public.faqs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can update faqs"
  ON public.faqs FOR UPDATE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can delete faqs"
  ON public.faqs FOR DELETE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE TRIGGER update_faqs_updated_at
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================
-- Seed inicial (edite/expanda no admin ou via SQL conforme a loja)
-- ========================
INSERT INTO public.faqs (question, answer, display_order) VALUES
  ('Vocês têm loja física?',
   'Temos sim! Ficamos em Belo Horizonte/MG. Confira o endereço e horário no nosso site; você pode comprar online e também combinar retirada na loja.',
   1),
  ('Como funciona o frete e o prazo de entrega?',
   'O frete é calculado no checkout do site pelo seu CEP. Hoje a política é frete grátis acima de R$ 299; abaixo disso há uma taxa. Bicicletas vão por transportadora; peças e acessórios menores podem ir pelos Correios. O prazo aparece junto do valor do frete ao finalizar.',
   2),
  ('Quais as formas de pagamento?',
   'Pix e cartão de crédito/débito direto no site (via Mercado Pago). Também dá para combinar o pagamento por aqui no WhatsApp se preferir.',
   3),
  ('As bicicletas vão montadas?',
   'As bikes enviadas por transportadora vão parcialmente montadas e encaixotadas, exigindo ajustes finais simples. Se retirar na loja, entregamos revisada e pronta para pedalar.',
   4),
  ('Vocês emitem nota fiscal?',
   'Sim, todo pedido sai com NF-e emitida automaticamente.',
   5),
  ('Como funciona a troca ou devolução?',
   'Você tem direito de arrependimento em até 7 dias após o recebimento (compra online), conforme o Código de Defesa do Consumidor, com o produto sem uso e na embalagem. Para trocas por defeito, vale a garantia. Me chama que eu te oriento o passo a passo.',
   6),
  ('Os produtos têm garantia?',
   'Têm sim. Vale a garantia do fabricante (o prazo varia por produto/marca) além da garantia legal. Para acionar, é só falar com a gente com o número do pedido.',
   7);
