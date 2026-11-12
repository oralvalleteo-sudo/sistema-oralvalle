# Resultado da avaliação de privacidade do NexoDent

**Há proteções técnicas, mas ainda não há comprovação suficiente para declarar o produto integralmente adequado à LGPD ou juridicamente pronto para comercialização.** Esta avaliação é um diagnóstico técnico de adequação para revisão jurídica, não um parecer formal ou garantia de ausência de falhas.

## O que foi confirmado

- A Política de Privacidade **existe no site**, identifica responsável e e-mail de privacidade. Ela aborda dados sensíveis, clínica/controladora, plataforma/operadora e direitos.
- No site e no cadastro observados, **faltam links para essa política**. O cadastro ainda diz que ela deverá ser publicada. No aplicativo não foram encontrados esses links ou os termos de contratação no fluxo de entrada.
- O sistema possui autenticação, permissões e controles SQL por clínica; há workflows de backup criptografado e telemetria automática mínima. Isso não comprova a configuração efetiva na produção, restauração de backups, contratos dos fornecedores ou todos os requisitos organizacionais.
- O produto usa localStorage/sessionStorage e serviços externos. Não foi encontrado Pixel, GTM ou Google Analytics no código revisado; isso não prova ausência de cookies HTTP no ambiente real.

## O que priorizar

1. **Informação antes do cadastro:** ligar e completar a política, avisos e contato; eliminar contradições entre site, cadastro e app.
2. **Contrato e responsabilidades:** finalizar termos/contrato SaaS e o instrumento de tratamento de dados com a clínica; definir fornecedor pessoa física/jurídica e registrar versões/aceite quando adotado.
3. **Dados de saúde e marketing:** definir bases por finalidade; não usar autorização geral da anamnese como consentimento para tudo. Separar atendimento, imagem, publicidade e contratação.
4. **Direitos e incidentes:** transformar o e-mail existente em processo com responsável, protocolo, identidade proporcional, encaminhamento à clínica e resposta segura. Definir o fluxo de incidentes e encarregado ou eventual dispensa aplicável.
5. **Guarda, encerramento e segurança operacional:** definir retenção, exportação, novas versões de documentos, backups e descarte. Não apagar prontuário por falta de pagamento; não prometer que todo dado será excluído imediatamente.
6. **Fornecedores e transferências:** conferir Supabase, GitHub, fontes/CDNs e serviços opcionais; confirmar regiões, contratos, subprocessadores e mecanismo de transferência quando necessário.

**Sobre o banner:** não é necessário instalar cookies nem pedir “aceitar tudo” para ter um sistema comercial. Primeiro confirmar o inventário real. Tecnologias necessárias e preferências solicitadas têm tratamento diferente de rastreadores opcionais sujeitos a consentimento. Quando for exigido consentimento, os opcionais devem ficar bloqueados até a escolha e a recusa deve ser respeitada.

## Documentos entregues

- [Avaliação completa e plano de adequação](AVALIACAO-LGPD.md): constatações, evidências, prioridades, bases a avaliar e critérios de conclusão.
- [Inventário de tratamentos](inventario-tratamentos.csv): dados, finalidades, papéis, fornecedores e retenção por operação.
- [Inventário de armazenamento do navegador](armazenamento-navegador.csv): chaves e tecnologias, categorias preliminares e ressalvas.
- [Evidências da navegação isolada](evidencias-navegador.json): telas e referências de rede, sem cadastros ou prontuários reais.

Foram analisados o sistema `199bc40` e o site `0174423`, na branch principal de cada repositório. Não foram consultadas bases de pacientes ou credenciais administrativas. As fontes oficiais de legislação não puderam ser consultadas online por bloqueio de rede; o jurídico deve confirmar vigência, enquadramento e contratos efetivos. Nenhuma política definitiva, termo ou banner foi publicado por esta avaliação.
