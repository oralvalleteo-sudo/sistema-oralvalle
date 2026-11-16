# Central de WhatsApp — versão 304

Em **WhatsApp → Central de contatos**, selecionar uma fila e data, buscar um paciente, preparar a mensagem e abrir a conversa. O envio é manual, individual e revisado pelo usuário. A central não acessa conversas, não recebe respostas e não verifica a integração oficial da Meta.

Filas: consultas do dia e próximos 7 dias (sem cancelamentos, faltas, reagendamentos, comparecimentos já registrados ou aluguéis), retorno após 180 dias sem novo agendamento, pós-atendimento dos últimos 7 dias com comparecimento registrado, aniversariantes e busca individual. Retorno usa comparecimento da agenda, não venda ou pagamento como prova de atendimento. São sugestões baseadas apenas nos dados carregados e autorizados; não há garantia de consulta a todo o histórico do banco.

Os modelos continuam separados em **Modelos de mensagens**, salvos neste navegador. Aceitam nome, data, hora e clínica. Sem consulta, data/hora mostram “a combinar”. Mensagens são mantidas somente em memória enquanto a tela é usada; trocar de clínica ou sair limpa a composição. Nenhum envio em massa ou automático foi acrescentado.

## Ativação do histórico compartilhado

Executar `supabase/migrations/202611160016_whatsapp_contact_center.sql` no SQL Editor do projeto correto. Requer a fundação clínica existente (`clinics`, `clinic_members`, `patients`, `appointments`, `private.require_member`). É SQL completo de `begin;` até `commit;`, reaplicável. A publicação do site não aplica migrações. O agente não possui credenciais administrativas do Supabase para executá-la.

Sem a ativação/conexão, as sugestões e a composição manual continuam disponíveis. Andamentos ficam indisponíveis, sem apresentar registros fictícios de contato. Depois da ativação, há estados declarados pela equipe: Pendente, Contato realizado, Aguardando retorno, Agendamento informado e Encerrado. Abrir o WhatsApp nunca marca um contato automaticamente. Marcar agendamento informado não cria nem confirma consultas.

O servidor exige membro ativo com acesso a WhatsApp e pacientes, edição de WhatsApp para gravar e consulta à agenda para filas de agenda. Verifica a vinculação do paciente e da consulta à clínica. Estados têm revisão otimista contra sobrescrita concorrente e registro idempotente por identificador de operação. Histórico guarda apenas paciente/contexto, andamento, data e responsável; não guarda mensagens, telefone ou nome do paciente. Tabelas não têm acesso direto concedido aos clientes. Há limite de 10 mil estados por consulta e 30 eventos por histórico individual. As regras comerciais de módulos continuam dependendo da implementação geral do servidor; esta migração verifica permissões de membros, não cria uma nova cobrança ou licença.

## Verificação e limites

Testes isolados cobrem filas, telefones, permissões entre clínicas, paciente de outra clínica, leitura sem escrita, proteção de agenda, repetição de requisição e conflito de revisão. Testes no navegador usam pacientes sintéticos, sem mensagens reais: edição, abertura manual sem registro fictício, separação de modelos, falhas do serviço, troca de clínica e limpeza da composição.

Não há confirmação de entrega/leitura, consentimento de marketing ou sincronização dos modelos entre dispositivos nesta versão. O registro de contato é uma declaração da equipe, não evidência de envio pelo WhatsApp. Não inserir conteúdo clínico desnecessário nas mensagens. Os novos registros devem ser incluídos nos processos de backup, retenção e atendimento de direitos da clínica; nenhum prontuário é alterado por esta migração.

## Apresentação e organização na versão 304

Filas em cartões com contagem real dos dados carregados; busca por nome/telefone com atualização local; filtros por validade do telefone e andamento quando o histórico estiver disponível; destaque do paciente selecionado; botão Próximo contato sem abertura ou envio automático. Prévia identificada como não enviada, renderizada como texto, e contador de caracteres. Layout em duas colunas no computador e uma no celular, com lista rolável e aviso antes de descartar uma mensagem editada ao trocar fila, data ou paciente. Mantém o cinza aprovado, sem alterações nos botões de outros módulos. Usa a mesma migração descrita acima; não exige outro esquema.
