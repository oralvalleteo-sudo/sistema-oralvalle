# Checkup do NexoDent — 11/11/2026

## Resultado e limite da revisão

Revisão do código da versão principal, testes automáticos, navegação no Chromium e PostgreSQL isolado com dados fictícios. **Não é certificação de segurança, teste de invasão em produção nem comprovação de que todas as operações de todos os módulos funcionam no serviço remoto.** Nenhum prontuário real foi aberto ou modificado. Não há credenciais administrativas do Supabase ou dos provedores neste ambiente.

Validação final: **32 testes de lógica/servidor/banco aprovados, sem ignorados, e quatro roteiros de navegador aprovados**. A auditoria de dependências consulta somente vulnerabilidades conhecidas. A disponibilidade pública do GitHub Pages é confirmada pela execução de publicação do GitHub; o domínio do Pages não é acessível diretamente pela política de rede deste ambiente.

## Falhas encontradas e correções

| Prioridade | Constatação | Correção e situação |
|---|---|---|
| Alta | Uma renovação de token anterior podia substituir a conta recém-autenticada. | Transporte invalida respostas de sessão ultrapassadas; sair limpa imediatamente a sessão local. Testes reproduziam o problema e passaram após a correção. Frontend publicado nesta revisão. |
| Média | Convite/recuperação não incluía o usuário confirmado na sessão usada pelo chat e documentos. | Identidade retornada pelo Auth é associada à sessão após verificação. Frontend corrigido e testado. |
| Alta | Identificadores interpolados diretamente em atributos HTML permitiam injeção de marcação caso um identificador adulterado chegasse ao cadastro/importação. | 155 interpolações passam pelo escape HTML. O navegador testou um identificador malicioso em paciente sem criar elemento injetado ou executar código. Isso não substitui revisão de todos os pontos de HTML do produto. |
| Alta | A proteção de exclusão de arquivo assinado estava na tela; uma chamada direta ao banco podia contorná-la. A listagem também removia o hash dos metadados, impedindo mostrar o botão de integridade. | Migration `202611110010_signed_file_protection.sql` adiciona guarda de alteração/exclusão e preserva metadados mínimos. Testada em banco isolado; **PENDENTE aplicar no Supabase de produção**. Não libera conteúdo do documento ou seu registro completo na listagem. |
| Média | Callback Google consumia estado OAuth em duas operações, não reconferia administrador revogado e retornava ao caminho incorreto no Pages. | Consumo atômico, nova validação de vínculo e retorno com subdiretório. Testes com provedor simulado aprovados. **PENDENTE republicar as Edge Functions**. |
| Controle | Um teste de recuperação de login tinha um DOM simulado desatualizado. Não era evidência de falha de login real. | O teste foi atualizado e voltou a verificar carregamento com falha, manutenção do bloqueio e nova tentativa sem reenviar senha. |
| Prevenção | A publicação não exigia os testes de funcionalidade e segurança. | GitHub Actions agora exige a suíte e os roteiros de navegador antes do deploy. Se falharem, não publica. |

## O que foi reproduzido

| Área | Evidência obtida | Limite |
|---|---|---|
| Entrada, sessão e saída | Aplicação real no navegador com Auth simulado e RPCs em PostgreSQL isolado; recuperação de falha e corridas de renovação. Na saída, menu e dados deixam de aparecer. | SMTP, links reais de convite, MFA, configurações Auth e sessões reais não foram acessados. |
| Pacientes | Cadastro pelo formulário real, persistência SQL, preservação de outro paciente e tratamento de identificador malicioso. | Não foi feita carga com o volume real da clínica nem importação/restauração em produção. |
| Agenda | Consulta criada pelo formulário real e confirmada na tabela de agendamentos. | Não cobre toda combinação de reagendamento, profissional, aluguel, horário e alertas em aparelhos físicos. |
| Navegação | Abertura de Pacientes, Lembretes, Dentistas, Vendas, Relatórios, Proposta Financeira, Precificação, Backup, Configurações, Assinaturas e Comunicação presentes no menu de teste. Cabeçalho e menu preservados. | Abrir a tela não equivale a validar cada cálculo, relatório, impressão ou operação dela. |
| Dados clínicos e sincronização | Protocolo paginado, revisão/conflito, anexos preservados durante edição e exportação, leituras independentes e rejeição de resposta inconsistente. | Configurações e políticas efetivamente instaladas no Supabase remoto não foram auditadas. |
| Permissões e clínica | Testes SQL de escopos e níveis, leitura e edição, usuário desativado, isolamento do chat, anexos privados e acesso a conversa alheia negado. | Não permite afirmar que todas as tabelas de CRM, laboratório e módulos criados fora das migrations deste repositório possuem políticas corretas no banco remoto. |
| Chat | Conversa, grupo, não lidas, remoção, acesso de leitura, desativação, arquivos, quota, limites de 10 MB, painel, rascunhos por clínica e navegação interna. | Sem validação de entrega em aparelhos reais, browser fechado ou rede de produção. |
| Notificações | Áudio depende de interação real, respeita silenciar, não repete o contador estável, não toca histórico, funciona com o controle da janela de chat. | Volume, modo silencioso, suspensão do navegador e Push com app fechado dependem do aparelho e do provedor. |
| Assinatura presencial | Revisão invalida desenhos anteriores; falha de gravação não anuncia sucesso; PDF legível; bytes baixados e arquivados conferem com SHA-256; download após sucesso não duplica arquivo. | Assinatura em imagem não prova identidade, tempo ou certificação ICP-Brasil. |
| A1 | Certificado sintético, senha errada, certificado vencido, chave correta na cadeia, sessão/permissão/CORS; PDF verificado criptograficamente por OpenSSL; recusa de PDF já assinado. | Serviço externo não implantado por esta revisão; sem certificado real, cadeia/revogação ICP-Brasil ou vínculo profissional verificado. Continua em testes. |
| Orçamento e cobrança | Centavos e vencimentos, Pix/débito à vista, limites de parcelamento e validação de valores/datas; API recusa emissão sem integração. | Não foi emitida nem cobrada transação real; preparação de cobrança não significa Pix/cartão operacional. Não houve ensaio completo de baixa/estorno/renovação/suspensão em produção. |
| Google Ads | Estado usado uma vez, administrador revogado impedido e URL de retorno correta, usando respostas simuladas. | Não conecta nem comprova importação de leads. Credenciais, consentimento Google, seleção e sincronização precisam de teste remoto. |
| Meta/WhatsApp e demais provedores | Inspeção de referências e configuração do código publicado. | Não há ensaio ponta a ponta autorizado/configurado com provedores reais nesta revisão. |

Os roteiros isolados não instalam o módulo administrativo da plataforma nem o registro histórico de pendências de documentos: respostas de recurso ausente são esperadas e identificadas no teste. Não foram substituídas por falsos sucessos.

## Proteção de dados observada

- Configuração publicada contém chave pública publishable; chaves privilegiadas são referidas por variáveis de servidor, não foram copiadas para os arquivos públicos. O empacotador inclui somente diretórios/arquivos permitidos, excluindo servidor, migrations, credenciais e arquivos de backup.
- O adaptador aplica escopo por clínica e não interpreta campos clínicos ocultos como exclusões. Uploads/consultas precisam de autorização no servidor.
- Telemetria do cliente envia categoria/área/versão, não mensagem, stack ou URL clínica, no código revisado.
- Sessão persistente, se escolhida pelo usuário, guarda tokens no armazenamento do navegador. Não é proteção contra um aparelho desbloqueado, extensão maliciosa ou XSS; controle dos aparelhos e cuidado com contas administrativas continuam necessários.
- Não foi testada restauração de backup real, rotação de credenciais, retenção, backups do Supabase, logs da hospedagem, exposição de buckets remotos ou configuração de MFA. Esses controles exigem acesso ao serviço e devem ser verificados antes de declarar proteção completa.

## Ativação pendente no ambiente remoto

1. Revisar e aplicar no SQL Editor a migration `202611110010_signed_file_protection.sql`, após backup e homologação. É aditiva, pode ser reaplicada e não apaga dados. **Depois dela, restauração que tente substituir/apagar documentos assinados será bloqueada; correções devem ser novas versões e restaurações completas desses registros exigem revisão administrativa fora do app.** A proteção só passa a valer no banco após essa aplicação.
2. Republicar `nexodent-google-ads-start` e `nexodent-google-ads-callback`. Configurar `NEXODENT_APP_ORIGIN=https://oralvalleteo-sudo.github.io` e `NEXODENT_APP_URL=https://oralvalleteo-sudo.github.io/sistema-oralvalle/`, além dos segredos Google já previstos. Validar autorização com conta de teste. Nenhum segredo deve ser enviado em conversa ou colocado no frontend.
3. Concluir o serviço A1 conforme `ASSINATURAS-PRESENCIAIS-A1.md`, antes do uso clínico.
4. Fazer homologação autenticada com contas de administrador, recepção, dentista e leitura, conferindo as políticas efetivamente instaladas para CRM, laboratório, documentos e demais módulos, além do backup e sua restauração em ambiente separado. O código desta revisão não substitui esse ensaio.

## Repetir a verificação

Com Node 22 atualizado ou 24, OpenSSL e Chromium disponíveis:

```sh
npm ci --ignore-scripts
PGLITE_MODULE=@electric-sql/pglite npm test
PGLITE_MODULE=@electric-sql/pglite CHROMIUM_BIN=/usr/bin/chromium npm run test:browser
python3 scripts/package_pages.py /tmp/nexodent-auditoria-publicacao
python3 scripts/check_pages.py /tmp/nexodent-auditoria-publicacao
```

A pasta de saída deve ser inexistente. O teste de assinatura usa certificado autogerado; OpenSSL confirma a integridade criptográfica, sem atribuir confiança ICP-Brasil ao certificado fictício.
