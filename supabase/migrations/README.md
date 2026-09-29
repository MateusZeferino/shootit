# Migrations

As alterações do banco são versionadas nesta pasta. A etapa 2 cria `profiles`
vinculada a `auth.users`. A etapa 3 cria `collections` com RLS por proprietário,
token público gerado pelo banco e atualização automática de `updated_at`.

A etapa 4 cria `photos` com `ON DELETE CASCADE` para os registros e o bucket
privado `photos`. O aplicativo remove primeiro os objetos via Storage API;
a cascata elimina somente os metadados restantes no banco. Nunca exclua linhas
diretamente de `storage.objects`, pois isso não remove os arquivos.

Após a integração com Cloudflare R2, o bucket Supabase permanece apenas no
histórico destas migrations. A aplicação usa a API S3 do R2 para todos os
arquivos e mantém as mesmas tabelas/RLS para os metadados. Não é necessária
uma nova migration para trocar o armazenamento; configure as variáveis R2
descritas no README principal e publique o código atualizado.
