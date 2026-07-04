# Atendente de WhatsApp com IA (Daniel) — Guia de instalação

Este guia liga o **atendente Daniel** no seu WhatsApp: ele responde sozinho,
estuda preços/estoque reais do site (catálogo do Bling), manda **uma** mensagem
de boas-vindas organizada no primeiro contato e chama um humano quando precisa.

A função que faz isso é `supabase/functions/whatsapp-webhook`.

**Novidades desta versão:**
- 🟢 **Boas-vindas com botões interativos** — no primeiro contato o cliente
  recebe botões clicáveis (em vez de só texto), o que facilita a conversa.
- ⌨️ **Indicador "digitando..."** — enquanto o Daniel pensa na resposta, o
  cliente vê "digitando..." no WhatsApp, como num atendimento de verdade.
- 🔁 **Retry automático do 9º dígito** — se a Meta recusar o envio por causa do
  formato do número brasileiro (com ou sem o 9), o código tenta o outro formato
  sozinho.
- ⚠️ **Mensagens não entregues ficam registradas** — se mesmo assim o envio
  falhar, a mensagem aparece no histórico da conversa com o prefixo
  `[NÃO ENTREGUE]`, pra você saber o que o cliente **não** recebeu.

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
     - ⚠️ O token de teste que aparece no painel **dura só 24 horas**. Para
       produção, gere um **token permanente** — passo a passo na seção
       [7. Token permanente](#7-token-permanente-obrigatório-para-produção).
   - **App Secret** (em *Configurações → Básico*) → secret `WHATSAPP_APP_SECRET` (opcional, mas recomendado).
4. Crie um **Verify Token** (uma senha qualquer que você inventa) → secret `WHATSAPP_VERIFY_TOKEN`.

---

## 2. Banco de dados (uma vez)

As tabelas (`whatsapp_conversations`, `whatsapp_messages`, `faqs`,
`service_orders`, `stock_alerts` e os toggles em `store_settings`) estão em
`supabase/migrations/`. Aplique de um jeito ou de outro:

- **CLI (recomendado):** `supabase db push`
- **Ou manual:** abra o Supabase → **SQL Editor** e rode, em ordem de data, o
  conteúdo de cada arquivo em `supabase/migrations/` a partir de `20260616...`.

> Rode o `supabase db push` de novo sempre que atualizar o projeto — esta versão
> adiciona a coluna `delivery_phone` (usada pelo retry do 9º dígito pra memorizar
> o formato de número que a Meta aceita entregar).

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

## 7. Token permanente (obrigatório para produção)

O token que a Meta mostra na tela de teste **expira em 24 horas**. Se você usar
ele em produção, o Daniel vai parar de responder no dia seguinte. Faça o token
permanente uma vez e esqueça:

1. Entre em **business.facebook.com** → **Configurações do negócio**.
2. No menu lateral, vá em **Usuários → Usuários do sistema** e clique em
   **Adicionar**. Dê um nome (ex.: `daniel-bot`) e escolha a função **Admin**.
3. Com o usuário criado, clique em **Adicionar ativos**, selecione o seu **App**
   (o mesmo que tem o produto WhatsApp) e dê controle total.
4. Clique em **Gerar novo token**, selecione o app e marque as permissões:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`

   Em **Expiração do token**, escolha **Nunca**. Copie o token gerado
   (ele só aparece uma vez!).
5. Atualize o secret com o token novo:
   ```bash
   supabase secrets set WHATSAPP_TOKEN=SEU_TOKEN_PERMANENTE
   ```
6. Publique a função de novo pra ela pegar o secret atualizado:
   ```bash
   supabase functions deploy whatsapp-webhook --no-verify-jwt
   ```

---

## 8. Checklist de teste ponta a ponta

Siga na ordem — se travar em algum passo, veja a
[Solução de problemas](#solução-de-problemas-leia-se-a-mensagem-não-chegar) logo abaixo.

1. **Número cadastrado como destinatário** no painel da Meta (*WhatsApp →
   Configuração da API → lista "Até"*), nas **duas** formas: com o 9
   (`5531982100836`) **e** sem o 9 (`553182100836`).
2. **Webhook verde**: em *WhatsApp → Configuration → Webhook*, o **Verify and
   Save** passou sem erro.
3. **Campo `messages` assinado** em *Webhook fields*.
4. **Secrets setados** no Supabase (tabela da seção 3 — principalmente
   `ANTHROPIC_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e
   `WHATSAPP_VERIFY_TOKEN`).
5. **Deploy feito**: `supabase functions deploy whatsapp-webhook --no-verify-jwt`.
6. Do seu celular, **mande "oi"** pro número do WhatsApp.
7. **Espere a mensagem de boas-vindas com botões** (você deve ver o
   "digitando..." antes dela chegar).
8. **Clique em um dos botões** e confira se o Daniel responde de acordo.
9. **Pergunte o preço de um produto real** do catálogo (ex.: "quanto custa a
   bike X?") e confira se o valor bate com o site. ✅

---

## Solução de problemas (leia se a mensagem não chegar)

Quando a Meta recusa um envio, ela devolve um **código de erro**. Os mais
comuns:

| Erro | Causa | Solução |
|---|---|---|
| **131030** | Seu número não está na lista de destinatários permitidos (enquanto o app está em **modo teste**, a Meta só entrega pra números cadastrados). Pegadinha do **9º dígito**: a Meta pode registrar seu número **sem o 9** (`553182100836`), e aí o envio pra versão com 9 falha. | O código já **tenta os dois formatos automaticamente** (com e sem o 9), mas o mais garantido é cadastrar o número nas **DUAS formas** na lista **"Até"** em *WhatsApp → Configuração da API* no painel da Meta. |
| **131047** | **Janela de 24 h fechada.** O WhatsApp só deixa a empresa mandar mensagem livre até 24 h depois da última mensagem **do cliente**. | Peça pro cliente mandar qualquer mensagem primeiro (isso reabre a janela), ou use um **template aprovado** pela Meta pra iniciar a conversa. |
| **190** | **Token expirado.** O token de teste da Meta dura só **24 horas**. | Gere um token permanente — seção [7. Token permanente](#7-token-permanente-obrigatório-para-produção) — e atualize o secret `WHATSAPP_TOKEN`. |

**Como ver os logs da função** (é onde esses códigos de erro aparecem):

```bash
supabase functions logs whatsapp-webhook
```

Ou pelo painel: **Supabase → Edge Functions → whatsapp-webhook → Logs**.

> 💡 Dica: quando um envio falha de vez (mesmo após o retry do 9º dígito), a
> mensagem fica salva no histórico da conversa com o prefixo `[NÃO ENTREGUE]` —
> abra a conversa no admin pra ver o que o cliente não recebeu.

---

## Dúvidas comuns
- **"Não respondeu"** → confira os *Logs* da função no Supabase e se os secrets
  estão setados. 90% das vezes é token da Meta ou `ANTHROPIC_API_KEY` faltando.
  Se o log mostrar um código de erro da Meta (131030, 131047, 190...), veja a
  seção [Solução de problemas](#solução-de-problemas-leia-se-a-mensagem-não-chegar).
- **"Respondeu mas sem preço certo"** → rode a sync do Bling (`/admin/bling →
  Forçar sync completa`) pra encher o catálogo no banco.
- **Trocar o tom/mensagens** → o jeitão do Daniel está no `SYSTEM_PROMPT` e a
  boas-vindas no `buildWelcome()`, ambos em `whatsapp-webhook/index.ts`.
