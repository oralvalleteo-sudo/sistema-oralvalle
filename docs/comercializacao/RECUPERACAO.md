# Ensaio de recuperação em ambiente separado

Estado: procedimento preparado; restauração real ainda não executada nesta revisão. Usar somente projeto descartável de homologação e operador autorizado. Nunca testar restauração apontando para produção.

## Antes de começar

1. Identificar backup, execução que o gerou, versão do exportador, origem e horário. Confirmar que a execução terminou com sucesso e o artefato tem tamanho plausível. Artefato existente não comprova recuperação.
2. Identificar o destino de homologação por projeto/host e confirmar que é diferente da origem. Restringir acesso. Usar credenciais específicas do destino em canal seguro, sem argumentos de linha de comando ou histórico do shell.
3. Conferir o escopo. O `.dump.age` completo contém o que o pg_dump conseguiu exportar; verificar avisos e inventário. Não contém os bytes dos objetos de Supabase Storage nem a configuração externa de Auth, SMTP, OAuth, Edge Functions, segredos e hospedagem.
4. Proteger a chave privada age fora do repositório e do artefato. A chave pública não decripta. Manter identidade e ambiente legível em diretório restrito; aplicar `umask 077` antes da decriptação e não enviar dumps a tickets.
5. Desabilitar e-mails, webhooks, pagamentos, mensagens, tarefas agendadas e demais saídas no destino. Dados fictícios são preferíveis; cópia real requer autorização, acesso restrito e descarte definido.

## Backup completo de banco

1. Recuperar artefato e identidade age pelo canal seguro. Decriptar com `age --decrypt`, usando arquivo de identidade restrito e saída local protegida. Os caminhos devem ser escolhidos pelo operador; não publicar arquivo legível.
2. Inspecionar o dump com `pg_restore --list` e verificar se o inventário esperado está presente: schemas, tabelas, funções, políticas e registros necessários. Usar cliente PostgreSQL compatível com o dump/servidor.
3. Preparar projeto de homologação com extensões, schemas/roles de plataforma e dependências compatíveis. Supabase gerencia componentes que não devem ser sobrescritos cegamente. Definir o plano de restauração conforme o conteúdo do dump; não usar `--clean` de forma indiscriminada.
4. Restaurar no destino conferido, sem tolerar erros silenciosos (`pg_restore --exit-on-error`). O comando específico depende dos objetos gerenciados e das permissões do projeto. Se houver conflito, interromper e revisar o inventário/plano; não ignorar erros para anunciar sucesso.
5. Restaurar separadamente objetos de Storage quando usados, preservando caminhos, metadados e acesso privado. Conferir referências/bytes e hashes. Anexos armazenados no banco devem ser verificados conforme o formato real.
6. Configurar Auth, URLs de retorno, SMTP de teste, funções e variáveis do ambiente de homologação. Não reutilizar segredos nem habilitar integrações que enviem dados reais. Restauração SQL não garante acesso às contas pelo provedor de autenticação.
7. Validar com contas sintéticas e permissões reais do destino. Conta privilegiada do banco pode contornar RLS e não serve para comprovar isolamento.

## Verificação mínima após restaurar

- Inventário e contagens das tabelas conferem com o snapshot; amostras não expõem pacientes em logs.
- Duas clínicas permanecem isoladas, inclusive arquivos, chat, laboratório, CRM e documentos.
- Dados clínicos, anexos, agenda e financeiro preservam relacionamentos e valores esperados.
- Documentos assinados preservam bytes, hashes e histórico; migrations de proteção impedem substituição indevida.
- Login, permissões, usuário desligado, exportação e uma alteração sintética funcionam.
- Integrações externas e tarefas continuam desabilitadas até configuração intencional.

## Snapshot individual por clínica

O `.json.age` individual é uma exportação, não uma restauração implementada. Decriptar em ambiente restrito e verificar `format`, `format_version`, `clinic_id`, registro da clínica, tabelas e relacionamentos. Conferir que nenhuma linha com `clinic_id` pertence a outra clínica.

O exportador seleciona tabelas com coluna `clinic_id`; dependências indiretas sem essa coluna podem ficar fora. Não inclui automaticamente schema, contas Auth, arquivos do Storage nem tabelas globais. **Não importar esse JSON diretamente na produção nem usar como único plano de recuperação.** Um importador futuro precisa tratar dependências, IDs, conflitos, referências de usuários e proteção de documentos assinados, com homologação própria.

## Registro de resultado

Registrar em controle privado: execução/artefato, horário do snapshot, horário da falha simulada, início/fim da recuperação, destino, operador, tabelas/arquivos esperados e recuperados, erros, exceções e aprovações. Medir perda de dados observada e tempo até validação para propor RPO/RTO sustentáveis. Frequência do agendamento não comprova esses objetivos.

Ao encerrar, confirmar descarte seguro dos arquivos legíveis, credenciais temporárias e ambiente descartável conforme política aprovada. Preservar apenas evidências mínimas, protegidas e sem cópia desnecessária de prontuários.
