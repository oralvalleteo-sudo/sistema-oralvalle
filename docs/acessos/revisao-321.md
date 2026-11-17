# Acessos dos usuários — versão 321

A aplicação carrega `assets/js/permissions.js`; a cópia em `features/permissions.js` foi sincronizada. Laboratório estava ausente do catálogo de permissões. Ortodontia, Implantodontia e Prótese compartilhavam a permissão de Lembretes. Relatórios ignorava a restrição explícita ao montar o menu. Documentos dependia apenas de permissões de prontuário. O editor agora representa todos esses módulos, incluindo Comunicação.

## Ativação no banco

Executar inteiro `supabase/migrations/202611170018_complete_user_access.sql` no SQL Editor como postgres. O arquivo é transacional e pode ser reaplicado. Ele amplia a validação das chaves, preserva wrappers existentes, instala a RPC administrativa já chamada pela interface e acrescenta políticas restritivas às tabelas laboratoriais existentes. Não promove ninguém automaticamente, não altera permissões salvas e não substitui as políticas anteriores de isolamento por clínica.

Sem executar o SQL, o banco antigo poderá rejeitar a gravação das novas chaves. A aplicação apresenta a falha e não confirma gravação em caso de rejeição. Não foi aplicado ao banco de produção nesta revisão: não há credencial administrativa disponível no ambiente.

## Como configurar

Em Configurações → Acesso dos usuários, conferir o nome/e-mail e o perfil real. Administrador tem acesso integral aos módulos contratados. Para personalizar abas, usar perfil não administrativo e selecionar Oculto / Só ver / Ver e alterar. Não é possível retirar o próprio perfil administrativo pela interface. Usuários inativos e de outra clínica não podem ser promovidos pela RPC.

Pacientes e Dados cadastrais também limitam Laboratório e especialidades. Documentos depende de Pacientes e Radiografias e documentos. Pagamentos Recebidos e Vendas compartilham o mesmo módulo. Relatórios depende das permissões das fontes e do plano contratado. Configurações e gestão dos acessos permanecem exclusivas de administradores; Minha conta e o portal de direitos de privacidade continuam disponíveis.

Permissões antigas sem as novas chaves preservam as dependências anteriores: Laboratório herda Pacientes; especialidades herdam Lembretes e Pacientes; Documentos herda Arquivos; Relatórios herda as fontes. Uma escolha explícita Oculto prevalece. A edição continua sujeita às regras de servidor dos dados usados, não apenas aos botões.

## Limites da revisão

Foram testadas a interface e as migrações em banco local com usuários sintéticos. Não foi possível inspecionar a conta real da secretária, as políticas instaladas manualmente nem o banco de produção. As permissões de navegação de especialidades não segmentam os campos do prontuário em domínios independentes: os dados compartilhados continuam protegidos pelas permissões de Pacientes. Ocultar Relatórios não retira acessos de dados já concedidos nos módulos financeiros e clínicos. As políticas adicionais laboratoriais não substituem a revisão de RPCs SECURITY DEFINER eventualmente instaladas fora deste repositório.

Antes de vender para novas clínicas, validar no ambiente real um administrador adicional e um funcionário com cada nível, a separação entre clínicas e os módulos contratados. Esta correção não constitui certificação de segurança ou garantia de ausência de erros em todo o produto.
