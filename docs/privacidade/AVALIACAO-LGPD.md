# NexoDent: avaliação de adequação à LGPD, transparência e proteção de dados

**Documento de diagnóstico para revisão; não é uma política pública nem um parecer jurídico formal.** Nenhuma página legal foi criada/publicada como se já estivesse validada. Nenhum dado de paciente foi consultado ou alterado.

## 1. Conclusão para a comercialização

**O material revisado ainda não sustenta afirmar que o NexoDent está integralmente adequado à LGPD ou juridicamente pronto para comercialização.** Há controles técnicos relevantes e uma Política de Privacidade no site, mas faltam ligação dessa política aos pontos de coleta, documentos contratuais e evidências operacionais importantes. Isso é um diagnóstico de lacunas do que foi disponibilizado, não uma declaração de ilegalidade da empresa ou prova de vazamento.

O problema não se resolve instalando um banner de cookies ou copiando uma política genérica. É necessário alinhar **funcionamento real, transparência, contrato, bases legais, direitos, retenção e segurança operacional**.

### Prioridades antes de ampliar a venda

1. Apresentar o aviso de privacidade antes do cadastro e disponibilizá-lo no site e aplicativo; atualizar o texto contraditório do cadastro.
2. Definir a identidade de quem comercializa e finalizar os termos/contrato SaaS e o instrumento de tratamento de dados com as clínicas.
3. Definir bases legais por operação e separar atendimento, contratação, comunicação assistencial e marketing. O termo da anamnese não resolve todas essas finalidades.
4. Comprovar acesso mínimo por função, políticas instaladas no banco, guarda segura, restauração de backup e o processo de incidentes.
5. Formalizar retenção e encerramento: exportar/entregar dados da clínica sem prometer apagar imediatamente prontuários sujeitos à guarda.
6. Confirmar fornecedores, locais de processamento e mecanismo de transferência internacional. Os workflows de backup também processam dados fora do navegador.

## 2. Escopo, versões e método

- Sistema: `oralvalleteo-sudo/sistema-oralvalle`, `main`, commit **199bc40**.
- Site: `oralvalleteo-sudo/nexodents-site`, `main`, commit **0174423**, consultado em checkout separado.
- Código, formulários, textos, fluxos de rede declarados, armazenamento no navegador, migrations, APIs e workflows de backup/publicação foram inspecionados.
- Navegação isolada em quatro telas: página inicial e cadastro do site, política e login do aplicativo. As requisições a terceiros foram interceptadas; o SDK de cadastro foi simulado. Não foram enviados formulários. Isso permite conferir a interface e referências de rede, **não medir cookies HTTP e processamento do ambiente real**.
- Resultados brutos em [evidencias-navegador.json](evidencias-navegador.json). Os inventários estão em [inventario-tratamentos.csv](inventario-tratamentos.csv) e [armazenamento-navegador.csv](armazenamento-navegador.csv).
- O checkup funcional anterior documentou 32 testes e quatro roteiros isolados aprovados; isso é evidência de funcionamento delimitado, não certificação LGPD. Consulte [o checkup técnico](../CHECKUP-SISTEMA-2026-11-11.md).
- Não há acesso administrativo a Supabase, provedores, dados reais, DNS, logs e contratos dos fornecedores. A instalação em produção das migrations não foi confirmada.
- A consulta à página oficial da LGPD no Planalto foi bloqueada pelo proxy de rede com HTTP 403. As referências normativas abaixo são indicadas para revisão; **não houve conferência online de vigência ou alterações normativas nesta execução**. O responsável jurídico deve confirmar a redação vigente e a aplicação ao negócio antes da aprovação final.

Os rótulos usados são: **confirmado no código/interface**, **não localizado no material**, **parcial** e **depende de comprovação em produção/organizacional**. Um procedimento não localizado no repositório pode existir fora dele; solicite sua evidência antes de concluir que não existe.

## 3. Constatações com evidências

| ID | Prioridade | Situação observada | O que precisa ser resolvido |
|---|---|---|---|
| L01 | Alta | **Existe política no site**, em `politica-de-privacidade.html`, atualizada em 10/11/2026. Identifica Ricardo Silva Junior e `app.nexodents@gmail.com`; aborda papéis, saúde, menores, fornecedores e direitos. | Não tratar a política como inexistente. Completar detalhes com o inventário e confirmar identidade comercial definitiva e aplicabilidade das declarações. |
| L02 | Alta | **Nenhum link legal** foi encontrado na página inicial ou no cadastro do site. O cadastro diz que a política “deverá ser publicada antes do lançamento”, embora o arquivo exista. O login/cadastro do app também não apresenta esses links. | Tornar a informação acessível antes da coleta, no rodapé e nas telas pertinentes, com texto coerente. Evidência: navegação isolada e fontes `site/cadastro.html`, `index.html`, `assets/js/supabase/integration.js`. |
| L03 | Alta | Termos de Uso/contrato, condições completas de contratação e registro versionado de aceite **não localizados** nos fluxos e migrations revisados. A única caixa no login é “Manter conectado”. | Finalizar contrato; apresentar previamente e registrar aceite quando adotado como mecanismo de contratação. Guardar versão, conteúdo/hash, conta, clínica, data de servidor e evidência de ação. Não exigir consentimento genérico a todo tratamento. |
| L04 | Alta | Não foi localizado contrato/instrumento de tratamento de dados da clínica com a plataforma ou sua lista de suboperadores. A política menciona esses contratos de forma genérica. | Documentar instruções, finalidades, responsabilidades, confidencialidade, fornecedores, incidentes, direitos, devolução, retenção e exclusão. Não há nome obrigatório para esse instrumento; um anexo contratual pode cumprir a função. |
| L05 | Alta | O termo da anamnese em `assets/js/state.js:13` pede autorização conjunta para CPF, saúde, odontograma, assinatura, agenda e cobrança. | Mapear a base de cada finalidade. Consentimento ao tratamento odontológico, aceite do contrato e ciência de aviso de privacidade são atos diferentes. Dados sensíveis seguem art. 11; legítimo interesse não é autorização geral para saúde. |
| L06 | Alta | Canal de privacidade **existe no site**, mas fluxo de triagem, verificação proporcional de identidade, encaminhamento à clínica, prazos e registro de atendimento **não foi evidenciado**. | Implementar procedimento de direitos. Não é obrigatório inventar um portal só para isso: e-mail com processo seguro e registros pode ser suficiente, conforme o caso. Paciente não deve ficar sem atendimento porque não é o contratante do SaaS. |
| L07 | Alta | Retenção está descrita genericamente na política. Não foi localizada matriz por categoria ou rotina completa de eliminação/restrição. Auditoria clínica guarda cópias anteriores/atuais em `private.clinic_audit_log`. | Incluir dados ativos, auditoria, chat, anexos, exportações, backups e dados locais. Definir motivo, início da contagem, prazo/revisão, acesso e descarte. Não confundir retenção de backup por 30 dias com guarda do prontuário. |
| L08 | Alta | A migration `202611110010_signed_file_protection.sql` protege documentos assinados, mas sua aplicação remota **não foi confirmada**. | Aplicar somente após revisão e homologação. A proteção contra alteração deve conviver com retificação por nova versão e com procedimento administrativo de retenção/eliminação legalmente cabível. Não prometer imutabilidade absoluta ou impossibilidade de exercer direitos. |
| L09 | Alta | Existem workflows de backup criptografado por `age`; há exportação local JSON sem criptografia no app. **Não houve evidência de execução bem-sucedida, gestão da chave ou restauração real**. | Comprovar rotinas, acesso aos artefatos, custódia de chaves e restauração. Incluir armazenamento de objetos/arquivos: o dump e o backup por clínica não incluem automaticamente os binários de Supabase Storage. Evitar cópias legíveis em pastas compartilhadas ou dispositivos sem proteção. |
| L10 | Alta | Mensagens de aviso podem conter nome, horário e procedimento; `sw.js` também exibe texto recebido do Push. | Preferir aviso externo genérico por padrão, com detalhes após autenticação. Avaliar tela bloqueada do aparelho, uso compartilhado e revogação das inscrições Push. Permissão de notificação do navegador não equivale a consentimento LGPD. |
| L11 | Alta | Uso de Supabase, GitHub/Pages/Actions, Google Fonts e jsDelivr identificado. Meta/WhatsApp/Google Ads e serviço Node/Vercel dependem do recurso/configuração. Região, contratos e transferências **não confirmados**. | Fazer cadastro de fornecedores e suboperadores, finalidades e dados mínimos; verificar países, subprocessadores e mecanismo aplicável de transferência. Não afirmar “dados só no Brasil” sem comprovação. |
| L12 | Alta | Não foi evidenciado plano de resposta a incidentes com responsáveis, avaliação de risco, comunicação e retenção do registro. O painel de ocorrências técnicas não comprova esse plano. | Criar procedimento e contatos de plantão; pactuar comunicação rápida do operador à clínica e cumprir prazos externos aplicáveis. Não depender de o cliente encontrar o erro no chat de suporte. |
| L13 | Média/alta | O app oferece níveis de acesso e RLS/RPCs, mas MFA obrigatório, configuração de sessão do provedor e revisões periódicas de acesso **não foram comprovados**. | Revisar contas individuais, desligamentos, menor privilégio, administração e MFA. Não há regra universal de senha/certificação única que, sozinha, torne o produto adequado à LGPD. |
| L14 | Média/alta | Há recursos para responsável legal do menor e alerta de conferência, mas isso não demonstra representação válida, base legal adequada ou prova específica de autorização. | Tratar melhor interesse e hipóteses aplicáveis do art. 14; orientar a clínica sobre identidade/representação e separar autorização clínica, uso de imagem e marketing. |
| L15 | Média/alta | Não foi encontrado fluxo completo de origem/base/opt-out das mensagens comerciais. Modelos manuais de WhatsApp existem; os padrões são genéricos e a tela orienta minimizar informações sensíveis. | Separar assistência de publicidade, fornecer oposição/revogação quando aplicável, manter supressão e comprovação. Não usar saúde, tratamento ou prontuário para segmentação publicitária sem análise específica. |
| L16 | Média | Não foi localizado aviso específico de cookies/armazenamento. Há localStorage/sessionStorage e referências externas. Não foi encontrado código de Google Analytics, GTM ou Meta Pixel nos fontes revisados. | Publicar informação fiel sobre tecnologias semelhantes e verificar o ambiente real. Não instalar rastreadores para justificar um banner; não afirmar que há publicidade por um arquivo chamado `commercial-analytics.js`, que faz métricas internas do CRM. |
| L17 | Média | Fontes Google são solicitadas antes de qualquer escolha do usuário; SDK/biblioteca de terceiros são carregados de CDN em alguns fluxos. | Avaliar necessidade, fornecedores e informação ao usuário; considerar hospedar fontes e bibliotecas localmente, com versões fixas. Não se conclui que uma fonte exige, por si só, o mesmo consentimento de um Pixel de publicidade. |
| L18 | Média/alta | O site usa links para `app.nexodents.com.br`, mas `config-public.js` aponta `oralvalle.vercel.app`; o sistema avaliado está publicado em GitHub Pages. | Definir domínios oficiais e conferir qual código está em cada hospedagem. Política, termos, callback de autenticação e contrato devem refletir o serviço realmente oferecido. |
| L19 | Média/alta | Coleta de conta usa SDK com persistência no site; o app oferece persistência opcional. Existem caminhos legados de armazenamento clínico local e resíduos possíveis. | Informar uso em aparelho compartilhado, estabelecer limpeza/migração segura, bloqueio e revogação. Não apagar bases antigas automaticamente sem backup e plano; não dizer que nada fica no aparelho. |
| L20 | Média/alta | A1 é técnico/de testes e a assinatura presencial é imagem em PDF com hash. | Não anunciar equivalência ICP-Brasil, carimbo do tempo ou garantia jurídica universal. Validar exigências de cada documento e regras profissionais; preservar evidências e versões. |

## 4. Papéis e bases legais: separar as relações

### Clínica e seus pacientes

Em regra, a clínica/profissional decide finalidades assistenciais e é controladora do prontuário; o NexoDent atua como operador na execução dessas instruções. A qualificação depende da operação real, não apenas do rótulo no contrato. A plataforma não recebe autorização para reutilizar prontuários para suas próprias finalidades só porque hospeda os dados.

Dados de saúde são sensíveis. Avaliar hipóteses do **art. 11**, conforme a situação: por exemplo, obrigação legal/regulatória, exercício regular de direitos ou tutela da saúde nas condições previstas na lei. Não adotar execução de contrato ou legítimo interesse do art. 7º como justificativa automática para todo dado sensível.

### NexoDent e seu contratante

A operação própria de conta, suporte, segurança e faturamento pode tornar o NexoDent controlador desses tratamentos. Identificar as bases pertinentes do art. 7º, finalidades e prazos. Manter dados de cobrança estritamente necessários; a análise muda se forem incluídos detalhes que revelem saúde.

A política já identifica pessoa física e um canal de e-mail. **A forma definitiva de comercialização por pessoa física ou pessoa jurídica e seus dados cadastrais ainda precisam ser confirmados.** Não é necessário enviar números de documentos em conversa para concluir este diagnóstico.

### Outros envolvidos

Hospedagem, autenticação, e-mail, backup, comunicação, pagamentos e assinador devem ser analisados conforme sua atuação. Alguns são suboperadores; outros podem agir como controladores independentes em operações próprias. Verificar contratos efetivos e não prometer que todos cumprem as mesmas funções.

Responsável legal, colaborador, dentista, lead e paciente são titulares distintos, com necessidades e avisos distintos. Imagem de assinatura não deve ser automaticamente descrita como biometria: avaliar se há uso biométrico para identificar de forma única.

## 5. Páginas e documentos necessários

A lei exige informação e práticas adequadas; não impõe em todos os casos um conjunto idêntico de URLs. Esta organização é recomendada para o produto:

| Documento/controle | Situação | Conteúdo e critério de conclusão |
|---|---|---|
| Aviso/Política de Privacidade da plataforma | Existe, porém parcialmente detalhada e sem links nos pontos observados | Responsável definitivo, dados, finalidades, bases, papéis, fornecedores, transferências, retenção por critério, direitos, canal, segurança proporcional, data/versão. Disponível antes do cadastro e no app. |
| Aviso da clínica ao paciente | Termo geral na anamnese, sem equivalência a aviso completo | Identificar clínica, usos assistenciais, guarda, compartilhamentos e canais. Plataforma pode oferecer modelo revisável, sem assumir que a clínica cumpriu suas obrigações apenas ao utilizá-lo. |
| Termos/contrato SaaS | Não localizado | Serviço e limites efetivamente disponíveis, teste, planos, preço, cobrança, cancelamento, suporte, suspensão, continuidade de acesso aos dados, exportação, guarda e responsabilidades proporcionais. Sem prometer recursos ainda não operacionais. |
| Anexo de tratamento de dados (DPA ou equivalente) | Não evidenciado | Instruções, confidencialidade, segurança, subcontratação, direitos, incidentes, transferências, término e evidências. Incluir tratamento de chat, anexos, logs, suporte e backups. |
| Aviso de cookies e armazenamento semelhante | Não localizado | Inventário real, categoria/finalidade, provedor, duração ou critério, escolhas e contato. Pode integrar a política se suficientemente claro/acessível; página separada não é obrigação universal. |
| Registro de contratação/aceite | Não localizado no fluxo | Evidência de ação do usuário, contrato exato e versão, conta/clínica, data de servidor e histórico. Coletar IP/user-agent apenas se necessário e com fundamento; não são requisitos universais para toda prova de aceite. |
| Canal/procedimento de direitos | E-mail público existente; processo não comprovado | Verificação de identidade proporcional, protocolo, responsável, encaminhamento à clínica, resposta segura e registro. Não exigir envio indiscriminado de RG/CPF por e-mail. |
| Retenção, descarte e término | Texto público genérico | Matriz por categoria, base, prazo, exceção de guarda, locais e quem executa. Explicar exportação e bloqueio/restrição quando eliminação imediata não for cabível. |
| Plano de incidentes | Não evidenciado | Detecção, contenção, preservação de evidência, classificação, decisão de notificar, responsáveis e comunicação com clínicas/titulares/autoridade. |
| Registro de operações e avaliação de risco | Inventário inicial produzido nesta revisão | Confirmar o inventário com a operação real. Dada a sensibilidade e possível escala, avaliar RIPD e hipóteses em que será exigido, sem presumir sua obrigatoriedade automática para qualquer SaaS. |
| Designação do encarregado ou enquadramento de dispensa | Não evidenciado | Avaliar regra aplicável e eventual dispensa válida. O e-mail de privacidade não comprova, por si só, designação. Mesmo em hipótese de dispensa, deve existir meio adequado de comunicação com titulares. |

**Não usar um único “aceito tudo”.** Aceitar os termos de contratação não significa consentir com marketing, e ler a política não transforma todos os tratamentos em consentimento. Consentimento, quando necessário, deve ser específico, demonstrável e revogável; opções não essenciais não devem vir pré-marcadas.

## 6. Cookies e armazenamento: decisão adequada ao que existe

O inventário completo está em [armazenamento-navegador.csv](armazenamento-navegador.csv). Pontos relevantes:

- O app guarda a sessão em sessionStorage ou localStorage conforme a opção de manter conectado. Tokens e perfis são dados a proteger; armazenamento local não possui expiração automática por si só.
- Preferências de som/cor e navegação usam armazenamento local. Algumas chaves contêm IDs de pessoa, clínica, paciente e datas: identificadores vinculáveis não são automaticamente dados anônimos.
- Há armazenamento legado de prontuário no modo local e armazenamento auxiliar de laboratório. A configuração atual de nuvem não implica limpeza de todos os resíduos anteriores.
- O site configura o SDK Supabase com sessão persistente. O nome/prazo efetivos das chaves precisa ser medido no ambiente real; o SDK foi simulado na inspeção isolada.
- Não foi encontrado `document.cookie` nem código de Pixel/gtag/GTM nos fontes revisados. Servidores e bibliotecas podem gerar cookies sem esse comando, e a hospedagem publicada pode diferir do repositório.

**Se houver apenas tecnologias estritamente necessárias ao serviço e preferências solicitadas**, informar adequadamente e justificar necessidade/base. Um banner de “aceitar cookies” não é obrigação automática só por existir login ou localStorage.

**Se forem introduzidos rastreadores opcionais sujeitos a consentimento**, bloquear sua execução antes da escolha; oferecer aceitar/rejeitar opcionais com facilidade equivalente; permitir granularidade e alteração posterior; registrar a escolha e respeitar revogação. Recusar marketing não deve impedir o uso de recursos que não dependem dele. Não registrar um falso “consentimento” com simples continuidade de navegação.

Fontes Google/CDN devem entrar no mapa de fornecedores e na análise de necessidade/transferência. Auto-hospedagem é uma medida de minimização recomendável; a conclusão jurídica não deve ser reduzida a “toda requisição externa exige consentimento” ou “HTTPS dispensa consentimento”.

## 7. Proteções técnicas identificadas e o que não está comprovado

**Evidências favoráveis no código:**

- Autenticação pelo Supabase; interface e RPCs verificam clínica e vínculo. SQL inclui RLS e restrições de acesso direto em tabelas clínicas.
- Controle de permissões, rejeição de campos/alterações indevidas, detecção de conflito de revisão e cuidado para não apagar conteúdo clínico apenas por estar oculto.
- Chat limitado à clínica e participantes, anexos privados com validação e limites.
- Telemetria automática mínima (`tipo`, `área`, `versão`), sem mensagem, stack ou URL no emissor revisado. Auditoria clínica é outra operação e guarda conteúdo anterior/atual.
- Workflows de backups cifrados por `age`, retenção de artefatos por 30 dias e preparação de restauração isolada. Existência do workflow não prova execução ou recuperação bem-sucedidas.
- Arquivamento de PDF presencial e hash; guarda de documento assinado prevista na migration 010.

**Não se pode concluir apenas lendo o código:**

- Que as migrations/políticas corretas estão instaladas em produção ou que todos os módulos/tabelas externos ao repositório têm o mesmo isolamento.
- Que MFA está habilitado/exigido, todos os usuários têm acesso mínimo e ex-colaboradores perderam acesso aos dispositivos, tokens e cópias já obtidas.
- Que banco, objetos, logs, backups e downloads têm criptografia e gestão de chaves adequadas em todos os locais. SHA-256 não cifra o arquivo, e TLS não comprova proteção em repouso.
- Que dados ficam exclusivamente no Brasil, que há certificação ISO/SOC ou conformidade integral dos fornecedores.
- Que backup recupera todos os anexos e que a restauração foi ensaiada.
- Que excluir o registro principal elimina versões, auditoria, anexos, artefatos, downloads ou documentos compartilhados.

**Cuidados prioritários:** avisos externos genéricos em telas bloqueadas; exportação JSON local sob custódia segura; dispositivos individuais/bloqueados; proibição de colocar senha/PFX/prontuário em suporte; atualização de bibliotecas e revisão de recursos externos; acesso administrativo restrito; evidência de backups e resposta a incidentes.

## 8. Direitos, incidentes, retenção e encerramento

### Direitos

Preparar atendimento para confirmação, acesso, correção, informação sobre compartilhamento e demais direitos cabíveis do art. 18, incluindo anonimização/bloqueio/eliminação nas hipóteses legais e portabilidade nos limites da regulamentação. Distinguir pedido do paciente à clínica de pedido relativo ao cadastro próprio do NexoDent; o operador deve cooperar. Para confirmação/acesso, observar a resposta simplificada ou a declaração completa no prazo previsto no art. 19 (em regra, até 15 dias para a declaração completa), com conferência jurídica da aplicação ao caso. Não atribuir esse prazo indistintamente a todo direito.

Revogação de consentimento não obriga apagar imediatamente registros que devam ser conservados por outra hipótese legal. Correção de prontuário não deve apagar seu histórico; novas versões e restrição podem ser necessárias. Se houver decisões exclusivamente automatizadas que afetem interesses, avaliar transparência e revisão nos limites do art. 20 — não foi demonstrado um fluxo desse tipo nesta inspeção.

### Incidentes

A LGPD e o regulamento da ANPD distinguem ocorrência técnica de incidente com dados pessoais sujeito a comunicação. Como referência a confirmar em sua redação vigente, a Resolução CD/ANPD 15/2024 prevê comunicação à ANPD e aos titulares em até **três dias úteis**, nas situações e condições do regulamento, e registro de incidentes por pelo menos cinco anos. A clínica controladora precisa de informações do operador em tempo hábil; pactuar prazo interno curto não altera o prazo legal. Não publicar promessa de que todo erro técnico será notificado ou de que nenhum vazamento pode ocorrer.

### Guarda e cancelamento

Avaliar a Lei 13.787/2018, regras odontológicas e peculiaridades do prontuário. A lei prevê prazo mínimo de 20 anos a partir do último registro nas hipóteses que disciplina; o enquadramento e regras profissionais devem ser confirmados. Isso não é justificativa para conservar todo lead, chat, cookie ou telemetria por 20 anos.

O contrato deve explicar o que acontece ao fim do teste, atraso, cancelamento, falecimento/encerramento da clínica e solicitações de entrega dos dados. Suspender funções comerciais não deve deixar sem solução a recuperação de documentos sob obrigação de guarda. Definir exportação, quem solicita, prazo, formato, acesso restrito após término e descarte legalmente admissível. Não estabelecer exclusão automática indiscriminada de prontuários por falta de pagamento.

## 9. Fornecedores e transferência internacional

| Serviço | Evidência/finalidade | Verificação a exigir |
|---|---|---|
| Supabase | Auth, banco, anexos e RPCs; URL pública no app/site | Entidade contratada, DPA, região efetiva do projeto, subprocessadores, suporte, logs, retenção, backups, segurança e instrumento de transferência quando necessário. |
| GitHub Pages | Hospedagem estática do app | Contrato/políticas de hospedagem, logs e dados de acesso, regiões/processamento e domínio oficial. Não presumir que apenas código passa pelo fornecedor. |
| GitHub Actions/Artifacts | Backup do banco e por clínica, além do CI com dados fictícios | Separar CI fictício de backup real. Execução do backup passa dados clínicos pelo runner antes/durante a cifragem; rever permissões, localização, chave `age`, retenção e logs. |
| Google Fonts | Referência e solicitação observada antes de interação | Dados técnicos da requisição, necessidade, auto-hospedagem e transparência. Não presumir recebimento de prontuário por esse carregamento. |
| jsDelivr | SDK Supabase do site e biblioteca PDF em fluxo do app | Dependências/versões, cadeia de execução, dados técnicos e alternativas locais; o teste isolado não confirmou cookies HTTP do CDN. |
| Meta/WhatsApp/Google Ads | Código/opções de integração e mensagens manuais | O que está realmente ativo, escopos, webhooks, tokens, destinatários, contratos e limites de publicidade, opt-out e exclusão. Capacidade futura não é compartilhamento já comprovado. |
| Node/Vercel para A1 | Origem configurável; vazia no arquivo revisado | Contrato, região, logs, tratamento transitório de arquivo/senha, acesso e comprovação técnica antes de ativar. Não declarar A1 em produção por haver arquivo de API no repositório. |
| E-mail/Push/pagamento | Confirmação de conta/avisos; pagamento ainda depende de integração | Identificar os fornecedores efetivos, dados mínimos, subprocessadores, países e retenção. Não inventar um provedor que ainda não foi escolhido. |

A Resolução CD/ANPD 19/2024 é referência para transferências internacionais e cláusulas-padrão contratuais. Avaliar se há transferência e qual mecanismo efetivamente a ampara, revisar contratos e versões vigentes e obrigações de transparência. Um texto público dizendo “o usuário concorda” não substitui automaticamente o mecanismo necessário.

## 10. Relação comercial e normas correlatas

- Confirmar identificação do fornecedor e informações da oferta conforme o regime aplicável. Avaliar CDC e Decreto 7.962/2013 quando a relação estiver abrangida; a incidência em contratação entre empresas depende do caso.
- Teste grátis de sete dias não substitui explicação de cancelamento, renovação, cobrança ou eventual direito de arrependimento legal. Não anunciar emissão de Pix, automações ou A1 qualificado antes da efetiva disponibilidade.
- Regras de assinatura e digitalização envolvem, conforme o caso, MP 2.200-2/2001, Lei 14.063/2020, Lei 13.787/2018 e normas profissionais. Imagem em PDF, hash e assinatura criptográfica com certificado de teste não são equivalentes nem dispensam exame do tipo de documento.
- O Marco Civil da Internet pode impor regras próprias sobre guarda/proteção de registros de acesso à aplicação, conforme o enquadramento. Não confundir esses registros com cópias integrais do prontuário ou com telemetria mínima.
- ISO 27001/27701 e SOC 2 podem ser controles/certificações contratuais úteis, mas não são selos automáticos da LGPD ou exigências universais para todo fornecedor. PCI DSS depende do escopo de pagamento; HIPAA/GDPR não se aplicam automaticamente só porque o sistema é de saúde no Brasil.

## 11. Plano de adequação e critérios para encerrar as pendências

| Ordem | Entrega | Responsável principal | Evidência de conclusão |
|---|---|---|---|
| 1 | Confirmar pessoa física/jurídica responsável, domínios e canal | Responsável pelo negócio | Cadastro comercial e decisões documentadas; nenhum dado inventado em política/contrato. |
| 2 | Revisar e ligar política/avisos aos pontos de coleta | Jurídico + produto | Links em início/cadastro/login/app; textos coerentes com inventário e acessíveis antes do envio. |
| 3 | Termos, contrato e anexo de tratamento de dados | Jurídico + comercial + técnico | Versões aprovadas, oferta real, matriz de responsabilidades e rito de aceite/alteração. |
| 4 | Confirmar fornecedores, região e transferências | Responsável pelo negócio + jurídico | Contratos/DPAs, subprocessadores e instrumento de transferência aplicável. |
| 5 | Direitos, incidentes e encarregado/dispensa | Responsável pelo negócio + jurídico + operação | Responsáveis, canal, protocolo de teste, fluxo de identidade/resposta, plano exercitado e registros. |
| 6 | Homologar acessos, banco e proteção de arquivos | Técnico + responsável das clínicas | Contas de perfis distintos, verificação de políticas em produção, migration 010 revista/aplicada quando aprovada, correção por versões. |
| 7 | Matriz de retenção, exportação e término | Jurídico + clínica + técnico | Critérios por tipo de dado, guarda e descarte possíveis, auditoria/backups incluídos e simulação sem apagar dados reais. |
| 8 | Revisar notificações, resíduos e exportação local | Produto + técnico | Aviso mínimo no bloqueio do aparelho; procedimento de dispositivos; custódia de exportações. |
| 9 | Cookies/armazenamento e opções quando necessárias | Produto + jurídico + técnico | Medição real antes/depois das escolhas; nenhum opcional dispara indevidamente; aviso fiel. |
| 10 | Aprovação final e revisão periódica | Responsável pelo negócio + jurídico | Itens críticos com evidência, riscos residuais aceitos por responsável, datas/versões e revisão após novos fornecedores/funcionalidades. |

Nesta entrega foi realizada **a avaliação e a organização das evidências**, não a implantação automática dessas medidas, elaboração de documentos jurídicos definitivos ou acesso à produção. Não foi alterado o aplicativo nem publicado aceite/política como juridicamente aprovado.

## 12. Referências para validação jurídica

Referências indicadas, sem consulta online concluída nesta execução:

- [LGPD — Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm): princípios e direitos, papéis, bases, saúde, menores, registros, segurança e incidentes.
- [Marco Civil da Internet — Lei 12.965/2014](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm).
- [Lei 13.787/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13787.htm): digitalização e guarda de prontuário, conforme seu alcance.
- [Lei 14.063/2020](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm) e [MP 2.200-2/2001](https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm): assinaturas, nas respectivas hipóteses.
- [Decreto 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm): comércio eletrônico nas relações abrangidas.
- [ANPD — portal institucional](https://www.gov.br/anpd/pt-br): guia de cookies; agentes de tratamento e encarregado; Resoluções CD/ANPD 2/2022, 15/2024 e 19/2024 e alterações aplicáveis; orientações sobre crianças/adolescentes e RIPD.
- [Conselho Federal de Odontologia](https://website.cfo.org.br/): regras profissionais e de prontuário a conferir segundo documento, contexto e norma vigente.

A aprovação jurídica deve usar as versões oficiais vigentes e contratos efetivos, sem presumir que menção a uma lei ou aprovação de testes técnicos seja certificação de conformidade.
