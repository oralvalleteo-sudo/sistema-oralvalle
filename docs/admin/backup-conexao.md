# Conexão do backup criptografado

A rotina `.github/workflows/backup-supabase.yml` aceita um segredo opcional `SUPABASE_DB_PASSWORD` contendo somente a senha atual do banco, sem codificação de URL. Quando configurado, substitui a senha extraída de `SUPABASE_DB_URL`. Não substitui o endereço, projeto ou usuário da conexão.

Manter `SUPABASE_DB_URL` com a URI do Session pooler do projeto esperado e `BACKUP_AGE_RECIPIENT` com a chave pública age. A chave privada não deve ser adicionada ao repositório. Os dados seguem criptografados antes de serem enviados como artefato, com retenção de 30 dias. Arquivos do Storage precisam de cópia separada.

Após atualizar os segredos, executar **Run workflow** na branch **main**. Reexecutar uma execução antiga utiliza o código daquela execução e pode não incluir esta correção.

O script valida o destino, fornece credenciais ao pg_dump por variáveis de ambiente, exige TLS e omite o diagnóstico bruto para evitar vazamento de credenciais. Falha de autenticação continua exigindo a senha correta do banco; não há contorno da autenticação. Nenhum teste local confirma acesso ao projeto real. Validar uma execução concluída, o artefato e uma recuperação em ambiente separado.

Testes: `python3 -m unittest discover -s tests/python -v`.
