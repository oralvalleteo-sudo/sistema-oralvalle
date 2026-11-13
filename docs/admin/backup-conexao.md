# Conexão do backup criptografado

As rotinas `.github/workflows/backup-supabase.yml` e `.github/workflows/backup-clinicas.yml` aceitam um segredo opcional `SUPABASE_DB_PASSWORD` contendo somente a senha atual do banco, sem codificação de URL. Quando configurado, substitui a senha extraída de `SUPABASE_DB_URL`. Não substitui o endereço, projeto ou usuário da conexão. Ambas validam o destino e exigem TLS.

Manter `SUPABASE_DB_URL` com a URI do Session pooler do projeto esperado e `BACKUP_AGE_RECIPIENT` com a chave pública age. A chave privada não deve ser adicionada ao repositório. Os dados seguem criptografados antes de serem enviados como artefato, com retenção de 30 dias. Arquivos do Storage precisam de cópia separada.

Após atualizar os segredos, executar **Run workflow** na branch **main**. Reexecutar uma execução antiga utiliza o código daquela execução e pode não incluir esta correção.

O script valida o destino, fornece credenciais ao pg_dump por variáveis de ambiente, exige TLS e omite o diagnóstico bruto para evitar vazamento de credenciais. Falha de autenticação continua exigindo a senha correta do banco; não há contorno da autenticação. Nenhum teste local confirma acesso ao projeto real. Validar uma execução concluída, o artefato e uma recuperação em ambiente separado.

Testes: `python3 -m unittest discover -s tests/python -v`.

Para executar a suíte, instalar antes `psycopg[binary]==3.2.9` em ambiente virtual. Os workflows já fazem essa instalação e executam os testes; a publicação do site também verifica essas regressões.

O backup individual exige uma pasta vazia, preserva arquivos de execuções anteriores e recusa pasta de saída que seja link simbólico. O diretório tem permissão 0700; o JSON temporário é criado com 0600 e removido no encerramento normal ou em erro tratado de criptografia. Encerramento forçado do processo ou do sistema exige limpeza segura do ambiente; não se promete remoção após SIGKILL. Mensagens brutas do banco e do criptografador não são impressas.

O snapshot individual inclui somente linhas identificadas por `clinic_id` e o registro da clínica. Não inclui automaticamente todas as dependências indiretas, contas Auth, objetos do Storage, schema ou políticas. Não é substituto da recuperação completa, e não há importador individual implementado. A exportação atual materializa tabelas na memória: homologar o volume máximo antes de depender dela.

Procedimento de ensaio e critérios de recuperação: [Recuperação em ambiente separado](../comercializacao/RECUPERACAO.md).
