# Daniel Bike Shop

E-commerce especializado em bicicletas, peças e acessórios — Belo Horizonte/MG.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn-ui (Radix)
- TanStack Query
- Supabase (auth, banco, storage, edge functions)
- Integração Bling (ERP — produtos, pedidos, NF-e)

## Rodando localmente

Pré-requisitos: Node.js 20+ e npm.

```sh
# 1. instalar dependências
npm install

# 2. configurar variáveis de ambiente
cp .env.example .env
# preencher .env com as credenciais reais do Supabase

# 3. dev server
npm run dev
```

A app sobe em `http://localhost:8080`.

## Scripts

| Comando            | Descrição                                  |
| ------------------ | ------------------------------------------ |
| `npm run dev`      | Dev server com HMR                         |
| `npm run build`    | Build de produção                          |
| `npm run preview`  | Preview do build de produção               |
| `npm run lint`     | ESLint                                     |
| `npm run test`     | Vitest (uma execução)                      |

## Estrutura

```
src/
├── components/        UI components (incl. shadcn em ui/)
├── contexts/          Auth, Cart, Wishlist
├── hooks/             Queries customizadas
├── integrations/      Cliente Supabase
├── pages/             Rotas públicas e /admin
└── lib/               Utilitários

supabase/
├── functions/         Edge Functions (Bling, admin)
└── migrations/        Schema SQL + RLS
```

## Segurança

- Nunca commitar `.env`. Use `.env.example` como referência.
- A `VITE_SUPABASE_PUBLISHABLE_KEY` é a chave **anon** do Supabase (pode ir para o cliente). A `SUPABASE_SERVICE_ROLE_KEY` fica **apenas em edge functions**.
- Toda tabela tem RLS habilitado; políticas estão em `supabase/migrations/`.

## Deploy

Deploy automático via Vercel a partir do branch `main`.
Configurar as variáveis de ambiente no painel da Vercel antes do primeiro deploy.
