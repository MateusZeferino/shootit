# Migrations

As alterações do banco são versionadas nesta pasta. A etapa 2 cria `profiles`
vinculada a `auth.users`. A etapa 3 cria `collections` com RLS por proprietário,
token público gerado pelo banco e atualização automática de `updated_at`.

A etapa 4 cria `photos` com `ON DELETE CASCADE` para os registros e o bucket
privado `photos`. O aplicativo remove primeiro os objetos via Storage API;
a cascata elimina somente os metadados restantes no banco. Nunca exclua linhas
diretamente de `storage.objects`, pois isso não remove os arquivos.
