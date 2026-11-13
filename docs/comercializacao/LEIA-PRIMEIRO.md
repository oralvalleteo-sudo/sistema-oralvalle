# Preparação comercial do NexoDent

Revisão em 13/11/2026, a partir da versão `b82540a`. Esta entrega corrige o backup individual e organiza a preparação comercial. Não é declaração de liberação jurídica nem comprovação do ambiente remoto.

## Resolvido nesta entrega

- Backup individual alinhado ao completo: senha separada, validação do projeto esperado e TLS.
- Pasta não vazia preservada, link simbólico recusado e arquivos temporários com acesso restrito.
- Erros do driver e do age sem diagnóstico bruto; limpeza do JSON em falhas tratadas.
- Testes de regressão de backup incluídos nos workflows de backup e publicação.
- Minuta SaaS, ficha de decisões, checklist de liberação e procedimento de recuperação preparados nos links abaixo.

## Já existia no código

Avisos de privacidade, canal de direitos, controle de versões/hash, recusa de aceite de minuta, permissões por clínica, proteção prevista para documentos assinados e painel administrativo. Não atribuir essas implementações a esta entrega. A existência no repositório não prova que migrations e configurações estejam ativas em produção.

## Ainda impede declarar a venda liberada

| Frente | Próxima ação | Responsável |
| --- | --- | --- |
| Empresa e fiscal | Confirmar fornecedor/CNPJ, CNAEs, regime e emissão de NFS-e | Titular e contador |
| Oferta e contrato | Preencher ficha, revisar minuta e anexo de dados, aprovar versões | Titular e jurídico |
| Produção | Conferir migrations, permissões reais, MFA e rotação da chave citada no README | Operador autorizado do Supabase |
| Recuperação | Comprovar execução, decriptação e restauração em ambiente separado | Operação técnica |
| Operação | Designar suporte/privacidade, testar cadastro e saída de uma clínica | Titular e operação |
| Recursos opcionais | Homologar provedores ou excluir essas promessas da oferta | Produto e operação técnica |

Pix/cartão de pacientes e A1 não precisam fazer parte da primeira oferta. O sistema não deve prometer emissão de cobranças ou assinatura qualificada enquanto essas capacidades não estiverem comprovadas. A cobrança da mensalidade do SaaS é uma operação distinta, que pode ter processo manual documentado se contratualmente e fiscalmente adequado.

## Documentos para execução

- [Checklist com evidências e responsáveis](CHECKLIST.md)
- [Ficha de decisões do fornecedor e oferta](FICHA-COMERCIAL.md)
- [Contrato SaaS — minuta para revisão](CONTRATO-SAAS-MINUTA.md)
- [Anexo de tratamento de dados já preparado](../privacidade/adequacao/ANEXO-TRATAMENTO-DE-DADOS-MINUTA.md)
- [Operação de direitos, incidentes e ativação jurídica](../privacidade/adequacao/OPERACAO-E-ATIVACAO.md)
- [Recuperação em ambiente separado](RECUPERACAO.md)
- [Resultados da verificação local](VERIFICACAO-2026-11-13.md)

As minutas internas não foram copiadas para `legal/` nem ativadas como contrato aceito. Campos comerciais desconhecidos permanecem explícitos. Este ambiente não tem segredos ou identidade administrativa configurados para Supabase, banco ou provedores; os itens remotos permanecem sem comprovação.
