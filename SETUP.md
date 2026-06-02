# Setup — Daniel Bike Shop

Guia completo para subir o projeto **do zero**, com Supabase novo, Mercado Pago, Resend e deploy na Vercel. Siga na ordem; cada passo depende dos anteriores.

> **Importante:** o usuário (você) precisa criar as contas externas (Supabase, Mercado Pago, Resend). O código está pronto, mas as credenciais são suas e nunca devem ir para o git.

---

## 0) Pré-requisitos

- Node.js 20+ (`.nvmrc` já fixado em 20)
- `npm` (lockfile do projeto é `package-lock.json`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase` ou `scoop install supabase`)
- Conta GitHub (para Vercel)
- Conta Mercado Pago **de produção** (não o sandbox sozinho — você vai precisar gerar o access token real)
- Conta Resend (e-mail transacional) — opcional mas recomendado

---

## 1) Criar o novo projeto Supabase

1. Acesse https://supabase.com/dashboard → **New project**.
2. Defina nome, região (`São Paulo (sa-east-1)` é o ideal) e uma senha forte para o banco.
3. Aguarde o provisionamento (~2 min).
4. Em **Project Settings → API**, copie:
   - `Project URL` → vai em `VITE_SUPABASE_URL`
   - `Project Reference ID` (o subdomínio antes de `.supabase.co`) → vai em `VITE_SUPABASE_PROJECT_ID`
   - `anon public` key → vai em `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → guarde, **não** vai no `.env` do cliente. É usada só como **secret** das Edge Functions.

### 1.1) Atualizar `.env`

O arquivo `.env` deste repositório já vem preenchido com o projeto
**`tswnprstidgeojdovsuz`** que você criou. Se algum dia mudar de projeto:

```bash
cp .env.example .env
# preencha .env com os valores novos
```

`supabase/config.toml` também já tem o `project_id` apontando para esse projeto.

---

## 2) Criar todo o banco — escolha **uma** das duas opções

### Opção A — Bundle SQL no Dashboard (mais simples, recomendada)

1. Abra **SQL Editor** no painel do Supabase → **New query**.
2. Cole o conteúdo de `supabase/bundle.sql` (gerado a partir de todas as migrations, em ordem cronológica).
3. Clique em **Run**.
4. Pronto: tabelas, RLS, buckets de Storage, RPCs e triggers de cupom criados.

> O `bundle.sql` é um snapshot. Se for fazer **novas** alterações depois, escreva uma nova migration em `supabase/migrations/` e regenere o bundle (ou use a Opção B daqui pra frente).

### Opção B — CLI (`supabase db push`)

```bash
supabase login                                # abre o navegador
supabase link --project-ref tswnprstidgeojdovsuz   # já pré-configurado em config.toml
supabase db push                              # aplica todas as migrations
```

Isso aplica os mesmos arquivos em `supabase/migrations/` na ordem certa.

### Migrar dados do Supabase antigo (opcional)

Se quiser **trazer dados** do projeto antigo:

- `pg_dump --data-only` no projeto antigo e `psql` no novo (apenas tabelas que você quer manter).
- Cuidado com sequências; IDs UUID já são compatíveis.
- Auth users não migram via dump — use `auth.admin.createUser` ou peça pra resetarem a senha.

---

## 3) Auth — Email/Senha

No painel: **Authentication → Providers → Email**

- ✅ Enable email signup
- ✅ Confirm email (recomendado em prod; pode deixar OFF em dev pra testar mais rápido)
- **Site URL**: a URL pública do site (ex. `https://danielbikeshop.com.br`). Em dev: `http://localhost:8080`
- **Redirect URLs**: adicione a URL pública + `http://localhost:8080` (o `signUp` redireciona para `/conta`)

### 3.1) Criar o primeiro admin

O projeto já tem uma edge function `create-first-admin` que só funciona se ainda não existir admin. Use ela uma vez (a `AdminLoginPage` mostra o formulário automaticamente quando não há admin):

1. Suba o app (`npm run dev`) e acesse `/admin/login`.
2. Como ainda não há admin, ele oferece o formulário de cadastro do primeiro admin.
3. Cadastre seu e-mail/senha e faça login.

---

## 4) Storage — Buckets

A migration já cria os buckets `product-images`, `banners` e `store-assets` com policies corretas. Verifique no painel **Storage** se aparecem.

---

## 5) Edge Functions — Deploy + Secrets

### 5.1) Deploy

```bash
supabase functions deploy validate-coupon
supabase functions deploy mp-create-preference
supabase functions deploy mp-webhook
supabase functions deploy send-order-email
supabase functions deploy bling-create-order
supabase functions deploy bling-check-connection
supabase functions deploy bling-sync-products
supabase functions deploy bling-validate-stock
supabase functions deploy bling-oauth-callback
supabase functions deploy check-admin-exists
supabase functions deploy create-first-admin
supabase functions deploy admin-create-user
supabase functions deploy admin-delete-user
```

### 5.2) Secrets

```bash
# Mercado Pago (obrigatório se for usar Pix/Cartão)
supabase secrets set MP_ACCESS_TOKEN="APP_USR-xxxxxxxxxxxx"
supabase secrets set MP_WEBHOOK_SECRET="seu_segredo_do_webhook"   # opcional mas recomendado

# Resend (opcional — sem ele, o app pula o envio de e-mail)
supabase secrets set RESEND_API_KEY="re_xxxxxxxxxxxxxxxx"
supabase secrets set RESEND_FROM="Daniel Bike Shop <no-reply@seudominio.com.br>"

# URL pública do site (usada pelo MP para back_urls)
supabase secrets set PUBLIC_SITE_URL="https://danielbikeshop.com.br"

# Bling (se for manter a integração)
supabase secrets set BLING_CLIENT_ID="..."
supabase secrets set BLING_CLIENT_SECRET="..."
```

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente pelo Supabase nas Edge Functions — você não precisa setar.

---

## 6) Mercado Pago

### 6.1) Pegar o access token

1. Acesse https://www.mercadopago.com.br/developers/panel/app
2. Crie uma aplicação (ou use uma existente).
3. Em **Credenciais de produção** copie o **Access Token** (`APP_USR-...`).
4. Coloque ele em `MP_ACCESS_TOKEN` (passo 5.2).

### 6.2) Configurar o webhook

1. Ainda no painel da aplicação, vá em **Webhooks → Configurar notificações**.
2. URL: `https://SEU_PROJECT_REF.supabase.co/functions/v1/mp-webhook`
3. Evento: marque **Pagamentos** (`payment`).
4. Clique em **Gerar chave secreta**, copie o valor, e coloque em `MP_WEBHOOK_SECRET` (passo 5.2). Sem isso o webhook funciona, mas qualquer um pode falsificar.

### 6.3) Domínio nas back_urls

`PUBLIC_SITE_URL` precisa ser **exatamente** o domínio público do site (com `https://`). Se você for testar em `localhost`, o MP **não** aceita auto-return (mas o pagamento ainda funciona; só não volta automaticamente).

---

## 7) Resend (e-mail transacional)

1. Crie conta em https://resend.com.
2. Em **Domains**, adicione seu domínio e configure os registros DNS (DKIM/SPF). Sem domínio verificado, o Resend só permite enviar para o e-mail do dono da conta.
3. Em **API Keys**, gere uma e coloque em `RESEND_API_KEY`.
4. Configure `RESEND_FROM` como `"Daniel Bike Shop <no-reply@seudominio.com.br>"`.

Se você não configurar o Resend, o app **continua funcionando** — a função `send-order-email` apenas pula o envio (log: "RESEND_API_KEY not set; email skipped").

---

## 8) Vercel — Deploy do front-end

1. Conecte o repositório do GitHub na Vercel.
2. Framework: **Vite** (detecção automática).
3. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
4. Em **Settings → Domains**, configure seu domínio. Atualize:
   - `PUBLIC_SITE_URL` no Supabase (passo 5.2)
   - **Site URL** e **Redirect URLs** no Supabase Auth (passo 3)
   - `<link rel="canonical">` e tags `og:url`/`og:image` em `index.html` se mudar o domínio

---

## 9) Imagem para Open Graph

Adicione `public/og-image.jpg` (1200×630, < 1 MB). Esse é o preview do site no WhatsApp/Facebook/Twitter. O `index.html` já referencia `https://danielbikeshop.com.br/og-image.jpg` — ajuste o domínio se for outro.

---

## 10) Sanity checks finais

```bash
npm install
npm test          # 12 testes devem passar
npm run build     # build de produção, deve terminar sem erros
npm run dev       # localhost:8080
```

Fluxo de fumaça:

1. `/produtos` carrega → adicionar item ao carrinho.
2. `/cadastro` → criar conta → confirmar e-mail (se habilitado).
3. `/carrinho` → aplicar cupom (cria um no admin antes: `/admin/coupons`).
4. `/checkout` → escolher **Pix** → confirmar → você cai no Mercado Pago.
5. Pagar (use a [conta de teste comprador do MP](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test-users)).
6. Voltar ao site → `/conta` → o pedido aparece com status **Pago**.
7. Conferir e-mails (criação + confirmação de pagamento).

---

## 11) Variáveis sensíveis — onde cada uma fica

| Variável                       | Onde                          | Vaza pro cliente? |
| ------------------------------ | ----------------------------- | ----------------- |
| `VITE_SUPABASE_URL`            | `.env`, Vercel                | Sim (público)     |
| `VITE_SUPABASE_PUBLISHABLE_KEY`| `.env`, Vercel                | Sim (anon key)    |
| `SUPABASE_SERVICE_ROLE_KEY`    | Supabase secrets              | **NÃO**           |
| `MP_ACCESS_TOKEN`              | Supabase secrets              | **NÃO**           |
| `MP_WEBHOOK_SECRET`            | Supabase secrets              | **NÃO**           |
| `RESEND_API_KEY`               | Supabase secrets              | **NÃO**           |
| `BLING_CLIENT_SECRET`          | Supabase secrets              | **NÃO**           |
| `PUBLIC_SITE_URL`              | Supabase secrets              | (URL pública)     |

Se alguma chave secreta vazar (commit acidental, screenshot, etc), **gire imediatamente**:

- Supabase: Settings → API → rotate
- Mercado Pago: painel → renovar credenciais
- Resend: revogar a API key e gerar nova
- Bling: revogar token OAuth e re-autorizar
