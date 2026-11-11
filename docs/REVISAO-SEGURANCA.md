# Revisão de segurança e usabilidade

Escopo: código dos dois repositórios, novos fluxos SaaS e pontos de renderização de documentos/anexos. Não constitui teste de invasão no domínio publicado nem certificação de ausência de vulnerabilidades.

## Problemas confirmados e corrigidos

- Imagens/assinaturas/anexos eram interpolados sem validação em atributos HTML de telas e impressões. Agora URLs de arquivos aceitam somente imagens raster base64, PDF base64 ou blobs locais nas funções apropriadas; javascript, SVG e quebra de atributo são rejeitados. Há teste com payloads maliciosos.
- APIs de certificado aceitavam qualquer usuário Supabase autenticado, sem comprovar vínculo/assinatura/permissão de documentos da clínica. Agora exigem clinic_id, membro ativo, recurso contratado e permissão de escrita antes de processar PKCS#12/PDF. Frontend foi atualizado e requisições sem autorização são testadas.
- O controle de assinatura era apenas administrativo. Foram acrescentadas verificações em RPCs clínicos, funções privilegiadas e políticas restritivas, com portal financeiro separado do acesso operacional. Conta de outra clínica e usuário comum não podem gerenciar pagamento.
- O preço/plano comercial era apenas informação de navegador. O preço de checkout é calculado no banco e o webhook consulta status/cliente/valor no provedor, sem confiar no corpo recebido. Eventos e contratos são deduplicados e tentativas ambíguas não são refeitas automaticamente.
- Cadastro anônimo não tinha limite no banco. Há limites por minuto/IP, e-mail e limite global para conter crescimento da fila. Cabeçalhos de IP são apenas defesa complementar; não comprovam identidade. Configurar também limites, CAPTCHA e políticas antiabuso no Supabase Auth antes de abrir campanhas em escala.
- SDK do cadastro era carregado de versão flutuante em CDN. Agora é local, com versão 2.119.0, licença e hash registrados. Dependências Node do sistema têm package-lock e npm ci; o relatório npm audit gerado para as versões resolvidas não reportou vulnerabilidades conhecidas. Isso não verifica automaticamente bundles de terceiros ou vulnerabilidades ainda não publicadas.
- Acrescentados CSP e Referrer-Policy nas páginas do site; headers anti-enquadramento, nosniff, referrer e CSP em vercel.json do sistema. GitHub Pages não aplica headers do vercel.json. A política mantém scripts inline existentes para compatibilidade; não é uma CSP estrita com nonces.
- O envio de PDF/certificado verifica também o tamanho do JSON em base64, evitando requisições que excedam o limite da hospedagem sem mensagem útil.
- Senhas de login são limpas após autenticação. Preferências de plano e idempotência usam fallback em memória quando o armazenamento do navegador é bloqueado.
- Textos e estados financeiros em português, links de regularização durante suspensão, consentimento de contratação, termos e domínio único. Testes automáticos de qualidade e segurança foram incluídos nos dois repositórios; a publicação manual do sistema depende dos checks.

## Necessário validar fora do código

- RLS/grants e RPCs realmente existentes no banco, especialmente extensões ausentes do Git; testar com administrador e funcionário de duas clínicas.
- App Meta, Google OAuth e permissões de produção; revisão dos provedores e isolamento dos ativos. Segredos reais não foram lidos ou rotacionados nesta revisão.
- Revogar credenciais que tenham sido expostas anteriormente; ativar MFA para contas administrativas dos provedores/hospedagem, proteção de branch e revisão de deploy.
- Limites/CAPTCHA do Auth, quotas, alertas de custo, retenção e backups com restauração testada. Proteções de borda/WAF e headers devem ser conferidos nos domínios reais.
- Homologação real Asaas, webhook e agendamento; tratamento operacional de tentativas unknown, contestações e dados acima do plano. Não há estorno financeiro automático por clique de cancelamento.
- Repetir revisão após novas funções/migrations. A guarda criada agora cobre funções existentes na instalação; novas APIs precisam validar clínica e direito de acesso explicitamente.

## Limites

Não houve varredura autenticada do ambiente publicado, teste de carga de produção, pentest externo ou garantia de segurança total. Testes locais e mocks não comprovam configuração segura dos serviços hospedados. Novas falhas podem surgir; manter atualização e monitoramento é parte da operação.
