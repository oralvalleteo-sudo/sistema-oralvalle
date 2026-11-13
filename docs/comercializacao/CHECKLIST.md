# Checklist de liberação comercial

Data da preparação: 13/11/2026. Marcar concluído somente com evidência e data. `Preparado` significa que há código/documento, não que o controle foi implantado ou aprovado. A revisão local não acessou dados de pacientes.

| Prioridade | Item | Estado nesta revisão | Critério de conclusão | Responsável |
| --- | --- | --- | --- | --- |
| P0 | Fornecedor e fiscal | Não confirmado | Identificação validada, atividade/regime definidos e NFS-e testada | Titular/contador |
| P0 | Oferta e condições | Ficha preparada | Preços, limites, suporte, cancelamento e exportação preenchidos e aprovados | Titular |
| P0 | Contrato SaaS | Minuta preparada | Revisão jurídica, identificação definitiva, proposta e versão aprovadas | Titular/jurídico |
| P0 | Tratamento de dados | Minuta anterior disponível | Anexo, retenção, papéis e fornecedores aprovados | Titular/jurídico |
| P0 | Catálogo e aceite | Código existente; remoto não confirmado | Mesma versão/hash no banco e interface; minuta não gera aceite; representante verificado | Técnico/contratante |
| P0 | Credencial citada no README | Revogação não comprovada | Registrar rotação/revogação no provedor sem copiar o segredo | Operador Supabase |
| P0 | Migrations de segurança | Instalação não comprovada | Conferir migrations 010, 011 e todas as dependências; testar permissões no ambiente alvo | Técnico |
| P0 | Isolamento de clínicas | Testes locais existentes | Em homologação, conta da clínica A não lê/escreve dados da B por RPC, REST ou arquivos | Técnico |
| P0 | Perfis e administração | Remoto não confirmado | Recepção, dentista, leitura, desligado e admin validados; MFA e recuperação administrativa conferidos | Técnico |
| P0 | Backup individual | Correção local testada | Publicar correção e confirmar execução real, conteúdo esperado e decriptação | Técnico |
| P0 | Recuperação completa | Procedimento preparado | Restaurar banco e arquivos em projeto isolado; registrar perdas, tempo e limites | Técnico |
| P0 | Cadastro e sessão | Testes locais existentes | E-mail, convite, recuperação, confirmação, saída e sessão revogada testados na infraestrutura real | Técnico |
| P0 | Implantação da primeira clínica | Não comprovada | Dados fictícios, duas clínicas, contas individuais, importação conferida e exportação legível | Operação |
| P0 | Operação clínica essencial | Testes locais existentes | Homologar agenda, prontuário, orçamento, financeiro, documentos e conflitos entre aparelhos | Operação/técnico |
| P0 | Cobrança da mensalidade | Não definida | Cobrar, conciliar, emitir nota, cancelar e tratar duplicidade pelo processo aprovado | Comercial/contador |
| P0 | Direitos e incidentes | Procedimentos anteriores disponíveis | Responsáveis nomeados; teste de pedido e incidente com protocolo, resposta e registro | Operação/jurídico |
| P0 | Fornecedores e transferências | Não comprovado | Relação real, contratos, regiões, suboperadores e instrumentos conferidos | Titular/jurídico |
| P0 | Publicidade e oferta | Exige revisão do material de venda | Só prometer recursos incluídos, limites e garantias comprovadas | Comercial |
| P1 | Admin operacional | Código existente; migration 015 não comprovada | Suporte e auditoria ativos; administrador de clínica sem acesso à plataforma | Técnico |
| P1 | Capacidade e custo | Não medidos nesta revisão | Medir volume, concorrência, anexos, quotas e custo por plano | Técnico/produto |
| P1 | Monitoramento e atualização | Parcial no código | Responsável recebe falhas, acompanha disponibilidade e consegue reverter publicação | Operação/técnico |
| P1 | Continuidade e saída | Procedimento preparado | RPO/RTO medidos e exportação testada; matriz de retenção aprovada | Operação/jurídico |
| P1 | Propriedade e marca | Não confirmadas | Titularidade/licenças revisadas; proteção de marca avaliada | Titular/jurídico |
| Condicional | Pix/cartão de pacientes | Integração não configurada | Incluir só após sandbox, webhooks autênticos, idempotência, conciliação e estorno | Técnico/provedor |
| Condicional | WhatsApp/Google | Produção não homologada nesta revisão | Autorização real, retorno, permissões, revogação e envio/sincronização comprovados | Técnico/provedor |
| Condicional | A1/ICP-Brasil | Restrito a testes | Confiança, revogação, identidade, política e validação independente; não anunciar como qualificado antes disso | Técnico/jurídico |

P0 são critérios propostos para decidir a primeira venda desta oferta, não uma lista de exigências legais universais. P1 deve ser priorizado segundo escala e compromissos assumidos. Itens condicionais podem ser retirados da primeira oferta e permanecer indisponíveis até sua homologação.

## Evidências que devem acompanhar a decisão

Para cada item concluído, registrar: item, versão/commit, ambiente, data, responsável, evidência restrita e limitações. Não copiar prontuários, certificados, tokens ou senhas para este repositório público. Evidências com dados pessoais ficam em controle privado com acesso mínimo.

| Registro da decisão | Preenchimento |
| --- | --- |
| Versão e ambiente que serão vendidos | PENDENTE |
| Oferta final e recursos excluídos | PENDENTE |
| Resultado dos itens P0 | PENDENTE |
| Piloto, duração e responsável | PENDENTE |
| Aprovação comercial/jurídica e técnica | PENDENTE |
| Data da liberação e revisão seguinte | PENDENTE |

Referências: `legal/config.js`, `legal/documents.json`, `docs/COBRANCAS.md`, `docs/ASSINATURAS-PRESENCIAIS-A1.md`, `docs/CHECKUP-SISTEMA-2026-11-11.md`, `docs/privacidade/adequacao/STATUS.md` e `docs/admin/operacao-saas.md`. Os registros antigos são evidência histórica, não confirmação do estado remoto atual.
