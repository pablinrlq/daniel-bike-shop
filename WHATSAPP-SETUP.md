# Atendente de WhatsApp com IA (Daniel) — Guia de instalação

Este guia liga o **atendente Daniel** no seu WhatsApp: ele responde sozinho,
estuda preços/estoque reais do site (catálogo do Bling), manda **uma** mensagem
de boas-vindas organizada no primeiro contato e chama um humano quando precisa.

A função que faz isso é `supabase/functions/whatsapp-webhook`.

---

## 1. Chaves que você precisa pegar

### 🔑 Claude API (a inteligência)
1. Entre em **console.anthropic.com** e faça login.
2. Em **Billing**, adicione um cartão / créditos.
3. Em **API Keys → Create Key**, copie a chave (começa com `sk-ant-...`).

> Modelo padrão: **Claude Haiku 4.5** (`claude-haiku-4-5`) — rápido e barato
> (US$1 / 1M tokens de entrada, US$5 / 1M de saída ≈ centavos por conversa).
> Dá pra trocar pelo `claude-sonnet-4-6` depois, mudando só o secret `CLAUDE_MODEL`.

### 🔑 Meta / WhatsApp Cloud API (o número)
1. Entre em **developers.facebook.com** e crie um App do tipo **Empresa**.
2. Adicione o produto **WhatsApp**.
3. Anote:
   - **Phone Number ID** (ID do número) → secret `WHATSAPP_PHONE_NUMBER_ID`
   - **Token de acesso** → secret `WHATSAPP_TOKEN`
     - Para produção, gere um **token permanente** em *business.facebook.com →
       Configurações do Negócio → Usuários → Usuários do sistema*, com as
       permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
   - **App Secret** (em *Configurações → Básico*) → secret `WHATSAPP_APP_SECRET` (opcional, mas recomendado).
4. Crie um **Verify Token** (uma senha qualquer que você inventa) → secret `WHATSAPP_VERIFY_TOKEN`.

---

## 2. Banco de dados (uma vez)

As tabelas (`whatsapp_conversations`, `whatsapp_messages`, `faqs`,
`service_orders`, `stock_alerts` e os toggles em `store_settings`) estão em
`supabase/migrations/`. Aplique de um jeito ou de outro:

- **CLI (recomendado):** `supabase db push`
- **Ou manual:** abra o Supabase → **SQL Editor** e rode, em ordem de data, o
  conteúdo de cada arquivo em `supabase/migrations/2026061*` e `2026062*`.

---

## 3. Secrets da função (Supabase → Edge Functions → Secrets)

Defina estes secrets (no painel, ou via CLI `supabase secrets set NOME=valor`):

| Secret | Para quê |
|---|---|
| `ANTHROPIC_API_KEY` | sua chave do Claude (`sk-ant-...`) |
| `CLAUDE_MODEL` | opcional. Padrão `claude-haiku-4-5` |
| `WHATSAPP_TOKEN` | token da Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número da Meta |
| `WHATSAPP_VERIFY_TOKEN` | a senha que você inventou (passo 1) |
| `WHATSAPP_APP_SECRET` | opcional, confere a assinatura dos webhooks |
| `WHATSAPP_OWNER_NUMBER` | opcional, seu número (recebe aviso quando a IA chama um humano), ex.: `5531999999999` |
| `PUBLIC_SITE_URL` | opcional. Padrão `https://danielbikeshop.com` |

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente.

---

## 4. Publicar a função

```bash
supabase functions deploy whatsapp-webhook --no-verify-jwt
```

(O `--no-verify-jwt` é necessário porque quem chama é a Meta, não um usuário logado.)

A URL fica assim:
```
https://SEU-PROJETO.supabase.co/functions/v1/whatsapp-webhook
```

---

## 5. Apontar o webhook na Meta

No painel do App (Meta) → **WhatsApp → Configuration → Webhook**:
- **Callback URL:** a URL do passo 4
- **Verify token:** o mesmo `WHATSAPP_VERIFY_TOKEN`
- Clique em **Verify and Save** (a função responde ao handshake automaticamente).
- Em **Webhook fields**, assine o campo **messages**.

Adicione o seu número comercial (ou use o número de teste da Meta) e mande um "oi"
pra ele. O Daniel deve responder. ✅

---

## 6. Ligar/desligar a IA

No admin, o toggle `store_settings.whatsapp_ai_enabled` liga/desliga o Daniel.
Quando um cliente pede um humano, a conversa vira `status = 'human'` e a IA para
de responder ali (um atendente assume).

---

## Dúvidas comuns
- **"Não respondeu"** → confira os *Logs* da função no Supabase e se os secrets
  estão setados. 90% das vezes é token da Meta ou `ANTHROPIC_API_KEY` faltando.
- **"Respondeu mas sem preço certo"** → rode a sync do Bling (`/admin/bling →
  Forçar sync completa`) pra encher o catálogo no banco.
- **Trocar o tom/mensagens** → o jeitão do Daniel está no `SYSTEM_PROMPT` e a
  boas-vindas no `buildWelcome()`, ambos em `whatsapp-webhook/index.ts`.
