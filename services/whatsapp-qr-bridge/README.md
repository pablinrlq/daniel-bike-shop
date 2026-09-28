# Ponte WhatsApp por QR Code (não oficial)

Este serviço conecta o WhatsApp Web via Baileys e encaminha somente mensagens
recebidas em conversas individuais para a Edge Function `store-assistant`.
Ele não envia campanhas, não inicia conversas e ignora grupos/status.

> Esta integração não é afiliada nem aprovada pelo WhatsApp. Pode desconectar
> ou causar restrições no número. Para operação crítica, use a Cloud API oficial.

## Requisitos

- Node.js 20+ ou Docker;
- computador/VPS sempre ligado;
- diretório/volume persistente para `WA_AUTH_DIR`;
- o mesmo `QR_BRIDGE_SECRET` configurado no Supabase e no serviço.

## Configuração

```sh
cp .env.example .env
# preencha a variável QR_BRIDGE_SECRET
set -a && . ./.env && set +a
npm ci
npm start
```

Para liberar conscientemente a inicialização:

```env
BRIDGE_ENABLED=true
BRIDGE_ACKNOWLEDGE_UNOFFICIAL_RISK=true
```

Escaneie o QR exibido no terminal em **WhatsApp → Aparelhos conectados →
Conectar aparelho**. Nunca publique o diretório `data/`: ele contém a sessão
completa do WhatsApp.

## Assumir uma conversa

O robô pausa automaticamente quando a IA transfere para humano. O vendedor
também pode enviar estes comandos na própria conversa:

- `!bot off` — pausa o robô naquele contato;
- `!bot on` — devolve a conversa ao robô.

Os comandos são aceitos apenas quando enviados pela própria conta da loja.
