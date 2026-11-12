# Nexodent Admin — etapa 1 (somente leitura)

1. Faça backup do banco antes de aplicar migrações.
2. Execute `supabase/migrations/202610290001_nexodent_admin_foundation.sql` no SQL Editor do projeto Supabase.
3. Identifique no Supabase Authentication o UUID exato da conta proprietária.
4. No SQL Editor, execute: `insert into public.nexodent_platform_admins(user_id) values ('UUID-DO-PROPRIETARIO');` substituindo o UUID.
5. Publique a pasta `admin/` junto com `assets/` e acesse `/admin/` em HTTPS.

**Segurança:** Não adicione chave service_role no navegador. O servidor valida o administrador em toda chamada RPC. Nenhum dado clínico é exposto pela RPC.

**Ainda NÃO implementado:** cadastro automático, período de teste, planos, assinaturas, cobranças, bloqueio por vencimento e domínio/subdomínio. O dashboard exibe apenas clínicas e vínculos existentes. A migração não altera registros da OralValle.

## Endereço atual

Abrir https://app.nexodents.com.br/admin/. Os recursos e o manifesto usam caminhos relativos para manter a pasta de instalação, inclusive em GitHub Pages. As permissões da plataforma continuam verificadas no servidor.

O script address.js redireciona apenas oralvalle.vercel.app para o endereço acima e não transporta query, fragmentos ou sessão. Para atuar na hospedagem antiga, essa hospedagem também precisa receber este código. Publicar o GitHub Pages não comprova implantação no Vercel. Favoritos e PWAs instalados no domínio antigo devem ser substituídos pelo acesso no domínio atual; sessão não é transferida entre origens.
