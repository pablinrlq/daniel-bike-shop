# Atendente de WhatsApp com IA (Claude)

Edge function que faz o WhatsApp da loja responder **sozinho**, como um atendente:
entende a pergunta, **consulta preço e estoque reais no catálogo** (que vem do Bling),
manda o link do produto, e sabe **passar para um humano** quando precisa.

```
Cliente no WhatsApp
      │
      ▼
Meta WhatsApp Cloud API  ──(webhook POST)──►  whatsapp-webhook (esta função)
                                                   │
                          ┌────────────────────────┼─────────────────────────┐
                          ▼                         ▼                          ▼
                   Claude API (tool use)     Supabase (produtos,        Meta Cloud API
                   gera a resposta           preços, conversas)         (envia a resposta)
```

A IA usa **tool use** (function calling) para buscar dados reais — ela nunca
"chuta" preço. As ferramentas: `buscar_produtos`, `detalhes_produto`,
`info_loja`, `escalar_humano`.

---

## 1. Pré-requisitos na Meta (WhatsApp Cloud API — oficial e gratuita p/ receber)

1. Crie uma conta no [Meta for Developers](https://developers.facebook.com/) e um **app** do tipo *Business*.
2. Adicione o produto **WhatsApp**. A Meta te dá um **número de teste** na hora (pode testar já); para produção, conecte o número da loja e verifique o negócio.
3. Anote:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Token** de acesso → `WHATSAPP_TOKEN` (gere um **token permanente** via System User; o token temporário expira em 24h)
   - **App Secret** (App settings → Basic) → `WHATSAPP_APP_SECRET`
4. Escolha um texto secreto qualquer para `WHATSAPP_VERIFY_TOKEN` (você inventa).

## 2. Segredos (Supabase)

```bash
# IA
supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."
# Opcional: modelo. Padrão é claude-opus-4-8. Para WhatsApp recomendo velocidade:
supabase secrets set CLAUDE_MODEL="claude-haiku-4-5"   # rápido e barato (ou claude-sonnet-4-6)

# WhatsApp (Meta)
supabase secrets set WHATSAPP_TOKEN="EAAG..."
supabase secrets set WHATSAPP_PHONE_NUMBER_ID="123456789012345"
supabase secrets set WHATSAPP_VERIFY_TOKEN="um_texto_secreto_que_voce_inventa"
supabase secrets set WHATSAPP_APP_SECRET="xxxxxxxxxxxxxxxx"        # recomendado (valida a assinatura)
supabase secrets set WHATSAPP_OWNER_NUMBER="5531999999999"        # opcional: recebe aviso de handoff

# Já deve existir do resto do projeto:
supabase secrets set PUBLIC_SITE_URL="https://danielbikeshop.com"
```

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente.

## 3. Banco + deploy

```bash
supabase db push                              # cria as tabelas de conversa (migration)
supabase functions deploy whatsapp-webhook
```

## 4. Apontar o webhook na Meta

No painel do app (WhatsApp → Configuration → Webhook):

- **Callback URL:** `https://SEU_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`
- **Verify token:** o mesmo valor de `WHATSAPP_VERIFY_TOKEN`
- Clique em **Verify and save** (a função responde o handshake `GET`).
- Em **Webhook fields**, assine o campo **`messages`**.

Pronto. Mande uma mensagem para o número e o atendente responde.

## A resposta não chega no celular? (modo teste + 9º dígito BR)

Em **modo teste** da Meta, o envio só entrega para números cadastrados na
*allowed list* do app — e o formato cadastrado pode divergir do `wa_id` que chega
no webhook (ex.: `5531982100836` com 9 vs `553182100836` sem 9). O envio (módulo
`_shared/whatsapp.ts`, usado por todas as funções) já trata isso:

- Se a Graph API recusar com **131030** (*recipient not in allowed list*), tenta
  **uma vez** o formato alternativo com/sem o 9º dígito e, se entregar, memoriza
  o formato que funciona na coluna `delivery_phone` da conversa (a coluna `phone`
  segue sendo o `wa_id` de entrada e nunca muda — é a chave de lookup).
- Toda falha sai no log com código, mensagem e dica (`131030` allowed list,
  `131047` janela de 24h fechada, `190` token expirado).
- Mensagens que não foram entregues ficam salvas na conversa com o prefixo
  **`[NAO ENTREGUE]`** — assim dá para ver no painel o que o cliente não recebeu.

Se mesmo assim não entregar: cadastre o número em *WhatsApp → API Setup → To*
(allowed list) ou publique o app para sair do modo teste.

---

## Escolha do modelo (velocidade × custo × qualidade)

Troque com `CLAUDE_MODEL` — sem mexer no código:

| Modelo | ID | Quando usar | Preço (entrada / saída por 1M tokens) |
| --- | --- | --- | --- |
| Haiku 4.5 | `claude-haiku-4-5` | **Recomendado p/ WhatsApp** — mais rápido e barato; ótimo p/ FAQ/preços | US$ 1 / US$ 5 |
| Sonnet 4.6 | `claude-sonnet-4-6` | Equilíbrio; respostas mais "espertas" | US$ 3 / US$ 15 |
| Opus 4.8 | `claude-opus-4-8` | Padrão do código; casos mais difíceis | US$ 5 / US$ 25 |

A função já é otimizada para **velocidade**: sem "extended thinking", respostas
curtas (`max_tokens` baixo), e **prompt caching** no system + ferramentas
(leituras de cache custam ~10% do preço normal). Na prática, uma conversa
típica custa centavos.

## Como funciona o "não precisa de pessoa cuidando"

- Responde 24/7, sozinho, com preço/estoque ao vivo.
- **Handoff:** se o cliente pede uma pessoa (ou a IA não resolve), ela marca a
  conversa como `human` e (se você configurar `WHATSAPP_OWNER_NUMBER`) te avisa.
  Enquanto a conversa estiver como `human`, a IA fica em silêncio — o humano assume.
- **Liga/desliga geral:** coluna `store_settings.whatsapp_ai_enabled` (dá para
  expor um botão no admin depois).
- Para devolver a conversa para a IA: mude o `status` da linha em
  `whatsapp_conversations` de `human` para `bot`.

## Aba de Serviços + avisos no WhatsApp (`service-notify`)

O admin tem a aba **Serviços** (oficina): registrar um serviço, mudar o status
(não iniciado → em andamento → concluído → entregue) e, a cada mudança, o cliente
é avisado no WhatsApp pela função `service-notify`.

```bash
supabase functions deploy service-notify
```

> ⚠️ **Janela de 24h da Meta:** mensagens proativas (fora de 24h da última
> mensagem do cliente) exigem um **template aprovado**. A função envia texto livre
> por padrão (funciona se o cliente falou com a loja nas últimas 24h). Para garantir
> a entrega sempre, crie um template na Meta com 2 variáveis no corpo
> (`{{1}}` nome, `{{2}}` status) e configure:
> ```bash
> supabase secrets set WHATSAPP_SERVICE_TEMPLATE="atualizacao_servico"
> supabase secrets set WHATSAPP_SERVICE_TEMPLATE_LANG="pt_BR"
> ```

## Follow-up proativo de vendas (`whatsapp-followup`)

A IA reengaja sozinha clientes que vieram do site, demonstraram interesse e não
fecharam — manda uma mensagem com jeito de vendedor, insistindo (com educação)
na compra. Liga/desliga na aba **Atendente IA**.

> ⚠️ **Regra da Meta:** mensagem livre só é permitida **dentro de 24h** desde a
> última mensagem do cliente. Por isso o follow-up só dispara nesse período,
> no **máximo 2 vezes** por cliente e espaçado. Fora de 24h exigiria template
> aprovado (não coberto aqui).

```bash
supabase functions deploy whatsapp-followup
supabase secrets set FOLLOWUP_SECRET="um_segredo_qualquer"   # protege o endpoint
```

Agende a execução (a cada 30 min) com pg_cron + pg_net no **SQL Editor** do
Supabase (troque `SEU_PROJECT_REF` e o segredo):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'whatsapp-followup',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/whatsapp-followup',
    headers := jsonb_build_object('Content-Type','application/json','x-followup-secret','um_segredo_qualquer'),
    body    := '{}'::jsonb
  );
  $$
);
```

Parâmetros (no topo de `whatsapp-followup/index.ts`): máx. 2 follow-ups,
espera 2h de silêncio, janela de 23h, 6h entre cutucadas.

## Treinar o atendente (admin → Atendente IA)

No admin, a aba **Atendente IA** liga/desliga o bot e gerencia a **FAQ** — o que
você escreve lá é injetado no system prompt e usado nas respostas na hora. É o
jeito mais rápido de "treinar" o atendente sem mexer em código.

## Base de conhecimento (FAQ)

A tabela `faqs` (migration `..._faqs_knowledge_base.sql`) guarda perguntas e
respostas (frete, troca, garantia, pagamento, loja física...). As FAQs ativas
são injetadas no **system prompt cacheado** a cada conversa — então o atendente
responde essas dúvidas na hora, sem chute e sem custo de busca. Edite/adicione
FAQs direto na tabela (ou num futuro `/admin/faqs`). Para uma base grande
(manuais, centenas de documentos), vale migrar para busca vetorial com pgvector
— o passo a passo está em `docs/analise-daniel-bike-shop.md`.

## Limitações desta v1 (próximos passos fáceis)

- Trata **texto**. Áudio/imagem recebidos ganham uma resposta padrão pedindo texto
  (dá para adicionar transcrição de áudio e visão depois).
- O catálogo é buscado por palavra-chave (ILIKE). Para busca semântica ("quero
  uma bike pra trilha barata"), dá para adicionar embeddings + pgvector no Supabase.
- Não cria pedido sozinho — direciona o cliente para finalizar no site (mais seguro).
