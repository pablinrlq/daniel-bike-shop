# Análise — Daniel Bike Shop (e-commerce, frete e atendimento com IA)

Documento de análise e recomendações. Não é código de produção — é o "mapa" do
que melhorar e como. Datado de 2026-06-16.

---

## 1. O que o site já é (e já está bom)

Stack moderna e bem montada:

- **Front-end:** React 18 + Vite + TypeScript, Tailwind + shadcn/ui, TanStack Query.
- **Back-end:** Supabase (Postgres + Auth + Storage + Edge Functions em Deno), com **RLS em todas as tabelas**.
- **Pagamento:** Mercado Pago (Pix + cartão) com webhook + opção "combinar via WhatsApp".
- **ERP:** integração Bling — sincroniza produtos e **emite NF-e automaticamente** (diferencial forte para uma loja pequena).
- **E-commerce completo:** catálogo, carrinho, lista de desejos, cupons validados no servidor, avaliações, painel admin (produtos, pedidos, estoque, cupons, banners, usuários, configurações).
- **SEO:** meta tags, sitemap, robots, Open Graph.

Conclusão: a base é sólida. Os maiores ganhos agora estão em **frete real** e **atendimento automatizado** (este último já implementado neste PR).

---

## 2. O maior furo: frete é fixo e faz perder dinheiro

### Como está hoje
`src/lib/shipping.ts` tem o frete **escrito na mão**: taxa fixa de **R$ 29,90**,
grátis acima de **R$ 299**. Não há cálculo por CEP nem por transportadora. O CEP
que o cliente digita no checkout (`useCepLookup`) só preenche o endereço via
ViaCEP — **não calcula frete**.

E tem um problema estrutural: a tabela `products` **não tem peso nem dimensões**,
e o sync do Bling (`bling-sync-products`) também não puxa esses campos. Sem peso e
dimensão, é **impossível** calcular frete real.

### Por que isso é grave para bicicleta
Bicicleta é volumosa. O frete é cobrado pelo **maior** entre o peso real e o
**peso cúbico** (volumétrico). Fórmula usada pelos Correios:

```
peso cúbico (kg) = (comprimento × largura × altura em cm) / 6000
```

Uma caixa de bike típica (~130 × 80 × 25 cm) dá **~43 kg de peso cúbico** mesmo
pesando ~18 kg reais. Ou seja: mandar uma bike por R$ 29,90 fixo significa
**pagar a diferença do próprio bolso em praticamente todo pedido de bicicleta**.

### Limites que eliminam os Correios para bikes montadas
Os Correios (PAC/SEDEX) aceitam até **30 kg**, com **máximo de 100 cm por lado** e
**soma das dimensões ≤ 200 cm** (acima de 70 cm em qualquer lado já há taxa extra).
Uma caixa de bike (130 cm de comprimento; soma ~235 cm) **estoura esses limites** →
**bicicleta inteira não vai pelos Correios**. Correios serve bem para **peças e
acessórios pequenos**; **bikes precisam de transportadora**.

Fontes: [limites Correios (Melhor Envio)](https://melhorenvio.com.br/blog/frete-e-logistica/limite-de-peso-correios/), [dimensões Correios (Loja Integrada)](https://ajuda.lojaintegrada.com.br/pt-BR/articles/6070497-quais-sao-as-dimensoes-maximas-e-minimas-permitidas-pelos-correios), [limites Jadlog (Frenet)](https://ajuda.frenet.com.br/knowledge-base/qual-o-limite-de-peso-e-dimensoes-da-jadlog).

### Transportadoras para bike encaixotada
- **Jadlog:** aceita até 120 kg, máx 80×80×80 cm; cobra taxa extra a partir de 50 kg (real ou cúbico). Muito usada para bike via plataformas agregadoras.
- **Loggi, Azul Cargo, Total Express:** também trabalham com volumes grandes; valem cotar.
- **Correios:** só peças/acessórios pequenos.

### Estimativas de custo de frete (APROXIMADAS — cotar para valores exatos)
> Não consegui fechar tabelas oficiais atualizadas; trate como ordem de grandeza.
> O peso cúbico da caixa de bike domina o preço.

| Envio | Origem BH → | Faixa aproximada | Prazo típico |
|---|---|---|---|
| Bicicleta encaixotada (~18 kg, ~43 kg cúbico) | Sudeste (SP/RJ) | R$ 90 – R$ 180 | 3–7 dias úteis |
| Bicicleta encaixotada | Sul / Centro-Oeste | R$ 130 – R$ 260 | 5–10 dias |
| Bicicleta encaixotada | Nordeste / Norte | R$ 200 – R$ 450+ | 7–15 dias |
| Peça pequena (~1 kg) | Brasil (Correios PAC) | R$ 20 – R$ 60 | 3–10 dias |

### Recomendação de frete (prioridade #1)
1. **Adicionar peso e dimensões aos produtos** e puxá-los do Bling no sync. O Bling já tem esses campos (`pesoBruto`, `pesoLiquido`, `dimensoes.largura/altura/profundidade`); o sync atual só ignora. É o pré-requisito de tudo.
   ```sql
   ALTER TABLE public.products
     ADD COLUMN weight_kg NUMERIC(8,3),     -- peso bruto
     ADD COLUMN length_cm NUMERIC(6,1),
     ADD COLUMN width_cm  NUMERIC(6,1),
     ADD COLUMN height_cm NUMERIC(6,1);
   ```
2. **Integrar um agregador de frete** para cotar por CEP no carrinho/checkout:
   - **Melhor Envio** e **SuperFrete**: sem mensalidade, cobram só por envio, têm **API pública** para site próprio, geram etiqueta e dão desconto em Correios/Jadlog/Loggi. ([comparativo](https://www.ruacep.com.br/guias/compras/comparativo-plataformas-frete-melhor-envio-superfrete-frenet/), [Melhor Envio](https://melhorenvio.com.br/blog/frete-e-logistica/plataformas-de-frete/))
   - **Frenet**: também boa para multi-transportadora.
   - O fluxo certo: numa Edge Function, receber CEP + itens (peso/dim somados), chamar a API do agregador, devolver as opções (transportadora, preço, prazo) e mostrar no checkout.
3. **Oferecer "Retirar na loja" (BH):** vocês têm loja física. Retirada = frete R$ 0, conversão maior e zero risco logístico. Ganho fácil.
4. **Mostrar prazo de entrega** junto do preço (hoje não existe).
5. **Rastreamento para o cliente** (o agregador devolve o código).
6. **Frete grátis com regra real** (por faixa de valor *e* região), só depois que o cálculo real existir — senão continua subsidiando no prejuízo.

---

## 3. Outras melhorias de e-commerce (priorizadas)

**Alto impacto**
- **Recuperação de carrinho abandonado** via WhatsApp/e-mail (casa com o atendente de IA deste PR).
- **Retirada na loja** (citada acima) — também serve para "reserva online, paga/retira na loja".
- **Cupom/【Pix com desconto】** visível — Pix tem custo menor; incentivar aumenta margem.

**Médio impacto**
- **Limpeza de código morto:** `src/data/products.ts` é um catálogo estático/legado (os produtos reais vêm do Supabase/Bling). Manter os dois confunde e gera bugs. Remover ou marcar claramente.
- **Busca de produtos melhor:** hoje é por palavra-chave; busca semântica ajuda ("bike pra trilha até 3 mil") — ver seção 5.
- **Página de FAQ no site** reaproveitando a tabela `faqs` criada neste PR.
- **Mais fotos/【specs】 padronizadas** (aro, quadro, marchas já existem como colunas — preencher sempre via Bling).

**Higiene**
- **Avaliações com moderação** (já existe `/admin/reviews`) — manter ativo contra spam.
- **Monitoramento do webhook de pagamento** (alertas se falhar).

---

## 4. Atendente de WhatsApp com IA (implementado neste PR)

Implementado em `supabase/functions/whatsapp-webhook/` + migrations
`..._whatsapp_ai_attendant.sql` e `..._faqs_knowledge_base.sql`.

- **Webhook da Meta WhatsApp Cloud API (oficial)** → Edge Function → **Claude (tool use)** → resposta.
- **Consulta preço/estoque reais** no Supabase (ferramentas `buscar_produtos`, `detalhes_produto`, `info_loja`) — nunca chuta preço.
- **FAQ** (frete, troca, garantia, pagamento...) injetada no system prompt **cacheado** — respostas instantâneas e sem custo de busca.
- **Memória por número**, **handoff para humano** (some quando uma pessoa assume), **liga/desliga** no admin (`store_settings.whatsapp_ai_enabled`).
- **Velocidade:** sem "thinking", respostas curtas, prompt caching, confirma leitura na hora.

Setup completo em `supabase/functions/whatsapp-webhook/README.md`.

---

## 5. RAG semântico (pgvector) — quando e como

**Decisão de engenharia:** para uma FAQ pequena (dezenas de itens), **colocar a
FAQ inteira no system prompt cacheado é melhor que busca vetorial** — mais rápido,
mais barato, sem outro serviço, sem latência de embedding. Por isso o atendente já
faz assim. **pgvector compensa quando a base cresce** (manuais, políticas longas,
centenas de produtos com descrições ricas, histórico).

Quando chegar essa hora, o caminho (tudo dentro do próprio Supabase):

1. **Habilitar pgvector e criar a coluna/【tabela】 de embeddings:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ALTER TABLE public.faqs ADD COLUMN embedding vector(1024);
   -- (ou uma tabela product_embeddings para o catálogo)
   ```
2. **RPC de similaridade** (busca por cosseno):
   ```sql
   CREATE FUNCTION public.match_faqs(query_embedding vector(1024), match_count int)
   RETURNS TABLE (question text, answer text, similarity float)
   LANGUAGE sql STABLE AS $$
     SELECT question, answer, 1 - (embedding <=> query_embedding) AS similarity
     FROM public.faqs
     WHERE is_active = true AND embedding IS NOT NULL
     ORDER BY embedding <=> query_embedding
     LIMIT match_count;
   $$;
   ```
3. **Gerar embeddings.** A Anthropic não tem modelo de embedding próprio; o
   recomendado é a **Voyage AI** (parceira da Anthropic) — ex. `voyage-3.5`,
   1024 dims, multilíngue (bom para PT-BR). Alternativa: OpenAI
   `text-embedding-3-small`. Uma Edge Function embeda as FAQs/produtos novos e
   grava na coluna `embedding`.
4. **No atendente**, adicionar uma ferramenta `buscar_conhecimento` que embeda a
   pergunta do cliente e chama `match_faqs`/`match_products`.

Custo de embedding é baixíssimo (centavos por milhares de itens) e só roda
quando o conteúdo muda.

---

## 6. Estimativas de custo (mensal)

**IA (Claude)** — preços por 1 milhão de tokens (entrada / saída):

| Modelo | ID | Indicado para | Preço |
|---|---|---|---|
| Haiku 4.5 | `claude-haiku-4-5` | **WhatsApp (recomendado)** — rápido e barato | US$ 1 / US$ 5 |
| Sonnet 4.6 | `claude-sonnet-4-6` | equilíbrio | US$ 3 / US$ 15 |
| Opus 4.8 | `claude-opus-4-8` | casos difíceis (padrão do código) | US$ 5 / US$ 25 |

Com prompt caching e respostas curtas, cada conversa custa **centavos**. Ex.: com
Haiku, alguns milhares de conversas/mês ficam tipicamente em **poucas dezenas de
reais** (varia com o tamanho das mensagens). Troca de modelo é só o secret
`CLAUDE_MODEL`.

**WhatsApp (Meta Cloud API):** a Meta passou a cobrar **por mensagem** (a partir
de jul/2025), com categorias (marketing / utility / authentication / service). O
atendimento iniciado pelo cliente (**service**) é a categoria mais barata e, na
janela de 24h, historicamente sem custo de template. Para o uso deste bot
(responder quem chama a loja), o custo de WhatsApp tende a ser baixo. **Confirme
as tarifas atuais para o Brasil no painel da Meta** — não consegui validar os
números exatos de 2026 aqui.

**Frete (agregador):** Melhor Envio / SuperFrete **sem mensalidade** — você paga
só o frete de cada envio (com desconto vs. balcão).

**Embeddings (só se for de pgvector):** Voyage/OpenAI — centavos por mês na escala
de uma loja.

---

## 7. Ordem sugerida de execução

1. ✅ **Atendente de WhatsApp com IA** (feito neste PR) — trocar `CLAUDE_MODEL` para `claude-haiku-4-5`.
2. **Frete real:** peso/dimensões do Bling → API Melhor Envio/SuperFrete no checkout → "retirar na loja".
3. **Rastreamento + prazo** para o cliente.
4. **Recuperação de carrinho** via o próprio WhatsApp.
5. **Página/admin de FAQ** reaproveitando a tabela `faqs`.
6. **pgvector** só quando a base de conhecimento crescer.
