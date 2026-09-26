# Shootit

MVP web/PWA para fotógrafos organizarem, publicarem e compartilharem galerias.

## Stack

- Next.js 16 com App Router e TypeScript
- React 19
- Tailwind CSS 4
- Supabase Auth, Postgres e Storage
- Vitest, Testing Library e Playwright

## Requisitos

- Node.js 20.9 ou superior
- npm
- Git
- Um projeto Supabase
- Docker apenas quando o ambiente Supabase local for utilizado

## Configuração

1. Instale as dependencias com `npm install`.
2. Copie `.env.example` para `.env.local`.
3. Preencha as credenciais exibidas em **Supabase > Connect**.
4. Execute a migration de `supabase/migrations` no projeto Supabase (SQL Editor ou CLI).
5. Execute `npm run dev` e acesse `http://localhost:3000`.

Nunca versione `.env.local` nem exponha `SUPABASE_SERVICE_ROLE_KEY` com o
prefixo `NEXT_PUBLIC_`.

## Scripts

- `npm run dev`: servidor de desenvolvimento
- `npm run build`: build de produção
- `npm run lint`: análise estática
- `npm run typecheck`: geração de tipos de rotas e verificação TypeScript
- `npm test`: testes unitarios
- `npm run test:watch`: testes em modo interativo
- `npm run check`: lint, tipos e testes em sequência
- `npm run test:policies`: testa grants, RLS e Storage com visitante e dois usuários temporários
- `npm run test:e2e`: testa o fluxo completo em navegador (execute `npm run build` antes)
- `npm run check:bundle`: verifica se a chave administrativa não entrou no bundle do cliente

## Estrutura

- `src/app`: rotas, layouts e estados globais da interface
- `src/lib/env.ts`: validação centralizada de variáveis de ambiente
- `src/lib/supabase`: clientes de browser, servidor e administração
- `supabase/migrations`: migrations SQL versionadas
- `supabase/config.toml`: configuração do ambiente Supabase local

## Status

A etapa 5 inclui galerias públicas em `/g/[publicToken]`, acessíveis sem login
por quem possui o link. Os arquivos continuam no bucket privado `photos` e são
exibidos por URLs temporárias. O banco guarda apenas metadados; a chave
administrativa é utilizada somente no servidor.

Para verificar upload, RLS e exclusão com dois usuários temporários no Supabase
configurado, execute `node --env-file=.env.local scripts/verify-photo-access.mjs`.
Se o app estiver rodando na porta 3000, acrescente `http://localhost:3000` ao
comando para também testar as rotas HTTP. O teste remove os dados que cria.

Com o app rodando, valide a etapa 5 com
`node --env-file=.env.local scripts/verify-public-gallery.mjs http://localhost:3000`.
Esse teste cria e remove um usuário, duas coleções e uma foto temporários.

## Etapa 6

O aplicativo tem manifesto, ícones, service worker mínimo e página offline.
Somente a página offline, ícones e arquivos de `/_next/static/` entram no cache
do service worker. O painel, as galerias, respostas da API, fotos e URLs assinadas
exigem conexão. O upload usa o envio simples até 6 MiB e TUS acima disso;
o limite total atual do bucket e da aplicação continua em 10 MiB por foto.

Para testar localmente após configurar `.env.local`, execute, nesta ordem:

1. `npm run check`
2. `npm run test:policies`
3. `npm run build`
4. `npm run check:bundle`
5. `npm run test:e2e`

Os testes de políticas e E2E usam o projeto Supabase configurado e criam/removem
usuários e arquivos temporários. Em Windows, o E2E usa Microsoft Edge instalado;
em outros sistemas, instale o Chromium do Playwright antes de rodar o teste.

Para publicar um preview, importe o repositório no Vercel e configure nele
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e
`SUPABASE_SERVICE_ROLE_KEY`. A última variável é secreta e nunca recebe o
prefixo `NEXT_PUBLIC_`. Mantenha a confirmação de e-mail habilitada no Supabase
e ajuste a URL do site no Supabase Auth para o domínio HTTPS usado no teste.
Valide o fluxo E2E nesse endereço antes de promover para produção.
