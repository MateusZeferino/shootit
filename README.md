# Shootit

MVP web/PWA para fotógrafos organizarem e compartilharem álbuns.

## Stack

- Next.js 16 / React 19 / TypeScript / Tailwind CSS 4
- Supabase Auth e Postgres: contas, álbuns, metadados e RLS
- Cloudflare R2 privado: originais, miniaturas e prévias
- Sharp: versões WebP de 640 px (miniatura) e 1600 px (visualização ampliada)
- Vitest, Testing Library e Playwright

## Configuração

1. Use Node.js 22 ou superior e execute `npm ci`.
2. Copie `.env.example` para `.env.local` e preencha as variáveis no formato `NOME=valor`.
3. Aplique as migrations de `supabase/migrations` ao projeto Supabase.
4. Crie um bucket R2 privado na classe Standard e um token S3 **Object Read & Write**, restrito a ele.
5. Configure `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY`.
6. Em R2 → bucket → Settings → CORS Policy, configure:

```json
[
  {
    "AllowedOrigins": [
      "https://shootit-ivory.vercel.app",
      "http://localhost:3000",
      "https://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Inclua a origem exata de qualquer domínio próprio ou preview que será usado.
Mantenha o acesso público `r2.dev` e os domínios públicos do bucket desativados.
CORS não substitui autorização; o backend emite URLs temporárias após validar o usuário/álbum ou o token público.

Execute `npm run dev` e abra `http://localhost:3000`.
Nunca versione `.env.local`. Credenciais administrativas e R2 são exclusivas do servidor,
sem prefixo `NEXT_PUBLIC_`.

## Fluxo das fotos

- JPEG, PNG e WebP estáticos, até **10 MiB / 50 megapixels**.
- O navegador envia os bytes originais direto ao R2 por PUT assinado (5 minutos),
  com tipo e tamanho assinados. O corpo da imagem não passa pelo endpoint de upload da Vercel.
- O caminho temporário fica em `usuario/album/pending/id.ext`.
  Um comprovante assinado vincula usuário, álbum, ID, tipo, tamanho e validade de 15 minutos.
- A finalização verifica os bytes, gera WebP e salva o original definitivo sem sobrescrita.
  Repetir a URL de upload temporária não modifica o original já finalizado.
- O banco recebe metadados somente depois que original e versões leves estão disponíveis.
- A galeria recebe apenas miniaturas/prévias por URLs de 5 minutos.
  O download valida álbum/foto e redireciona para o original com URL de 60 segundos.
- A finalização pode ser repetida após falhas transitórias, sem duplicar registros.
  Arquivos validados são preservados para essa tentativa; o temporário é removido após sucesso.
- Exclusão de foto remove os três arquivos antes do registro.
  Exclusão de álbum/conta remove também uploads incompletos sob seu prefixo.
- Uploads são diretos, sem TUS; falhas durante a transferência exigem reenviar aquele arquivo.
  O resultado de cada arquivo da fila é independente.

As tabelas e suas políticas RLS continuam no Supabase. As antigas migrations de Storage
ficam no histórico, mas a aplicação e os testes atuais de fotos usam R2. Não existe migração
automática de arquivos antigos nem dependência do bucket Supabase para novos uploads.

## Visibilidade dos álbuns

- `collections.is_active` controla somente a exposição pública do álbum.
- O painel privado do fotógrafo deve listar e permitir o gerenciamento de álbuns ativos e inativos.
- A galeria compartilhada exige correspondência exata do `public_token`. Quando o álbum está
  inativo, ela exibe apenas o estado de indisponibilidade, sem consultar ou expor fotos.
- Um futuro perfil público do fotógrafo deve carregar os álbuns no servidor e aplicar
  obrigatoriamente o filtro `is_active = true`.
- Se essa consulta usar o cliente administrativo (`service_role`), o filtro explícito é obrigatório,
  pois esse cliente ignora RLS. O papel anônimo continua sem acesso direto às tabelas.
- A consulta pública deve selecionar somente os campos necessários. Reativar um álbum preserva
  seu `public_token` e restaura o mesmo link de compartilhamento.

## Testes e operação

- `npm run check`: lint, TypeScript e testes unitários.
- `npm run test:r2`: conexão, CORS, PUT/GET assinados, original íntegro e expiração.
- `npm run test:policies`: grants e RLS de perfis, álbuns e metadados com usuários A/B e visitante.
- `npm run build`: build de produção.
- `npm run check:bundle`: ausência das credenciais Supabase/R2 no JavaScript público.
- `npm run test:e2e`: inicia o build local na porta 3000 e testa navegador,
  upload, download original, galeria mobile/desktop, exclusão e PWA.
- `npm run test:photo-access`: com app na porta 3000, testa autorização HTTP,
  comprovantes adulterados, repetição de upload e exclusão no R2.
  Aceita outra URL: `npm run test:photo-access -- https://seu-preview.example`.
- `node --env-file=.env.local scripts/backfill-photo-variants.mjs`:
  verifica versões WebP ausentes no R2; `--apply` gera somente as faltantes.

Os testes reais criam e removem contas e arquivos próprios no Supabase/R2 configurados.
No Windows, o E2E usa o Edge instalado; em outros sistemas, instale o Chromium do Playwright.
O teste de CORS usa localhost:3000 e o domínio de produção listado acima.

## Publicação na Vercel

Configure as três variáveis Supabase e as quatro variáveis R2 de `.env.example`
no ambiente correspondente (Production/Preview), depois publique o código atualizado.
Somente cadastrar as variáveis não troca o provedor usado por um build antigo.
Mantenha as URLs do Supabase Auth e as origens CORS coerentes com o domínio publicado.

O service worker guarda apenas shell offline, ícones e assets estáticos.
Galerias, respostas pessoais, fotos e URLs assinadas exigem conexão e não entram no cache offline.

Referências: [R2 S3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/),
[URLs assinadas](https://developers.cloudflare.com/r2/api/s3/presigned-urls/),
[CORS](https://developers.cloudflare.com/r2/buckets/cors/).
