# Assinatura presencial e certificado A1

## Fluxo do paciente na clínica

Em Documentos e Assinaturas → Assinatura manuscrita:

1. O profissional seleciona paciente e dentista e preenche o título e o texto.
2. As duas pessoas revisam o documento e desenham suas assinaturas com mouse, dedo ou caneta.
3. O profissional confirma o consentimento e escolhe “Salvar PDF assinado no prontuário”.
4. Somente após confirmação do Supabase o sistema anuncia sucesso e baixa o mesmo PDF arquivado. O arquivo aparece em Radiografias e documentos do paciente.

O paciente não precisa de conta, aplicativo ou certificado A1. O fluxo usa a sessão profissional já conectada e a permissão existente de escrita em arquivos do paciente. Alterar paciente, dentista ou conteúdo apaga as assinaturas; elas precisam ser recolhidas. Se houver falha de rede, conferir a sincronização e o prontuário antes de repetir. Repetir o download após sucesso não cria outra cópia no prontuário.

O documento inclui registro da captura, profissionais, consentimento e hash do conteúdo. O SHA-256 do PDF é calculado sobre os mesmos bytes arquivados e baixados. O hash detecta mudança em relação ao registro; não é prova independente de identidade, tempo ou autoria. A assinatura é eletrônica simples, em imagem, e não equivale a ICP-Brasil. Não há trava imutável ou carimbo do tempo certificado neste fluxo.

## A1: serviço Node separado

O GitHub Pages hospeda arquivos estáticos e **não executa `api/*.js`**. Não basta publicar esses arquivos no GitHub para ativar o A1.

Para testar o serviço:

1. Implantar o repositório em runtime Node/Vercel com dependências instaladas por `npm ci`. Manter `api/`, `server/`, package.json e package-lock.json na implantação.
2. Configurar somente no servidor: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (ou a chave pública publishable usada como apikey) e `CERTIFICATE_ALLOWED_ORIGINS=https://oralvalleteo-sudo.github.io`. Não usar service_role.
3. Definir `certificateApiUrl` em `assets/js/supabase/config.js` com a origem HTTPS desse serviço. O navegador envia o certificado, sua senha, PDF e token da sessão somente a esse destino configurado. Nenhum arquivo A1 nem senha é salvo intencionalmente pelo código. Configurar também os logs e políticas de retenção da hospedagem para não coletar corpos de requisição.
4. Validar os endpoints `/api/certificado-inspecionar` e `/api/certificado-assinar-pdf` com certificado e PDF sintéticos. CORS aceita apenas origens explicitamente configuradas. A API valida sessão, vínculo ativo e permissão de edição na clínica.

Limites do serviço: certificado de até 1 MiB, PDF de até 2 MiB (respeita o limite de corpo do runtime Vercel após codificação base64). PDF criptografado ou incompatível é recusado. PDF já assinado é recusado para preservar as assinaturas anteriores. Certificados fora da validade, chave incompatível e e-CNPJ são recusados para assinatura. A senha é apagada do campo após a tentativa, inclusive na falha.

**A1 continua restrito a testes:** a inspeção técnica não verifica cadeia ICP-Brasil, revogação, titularidade do profissional autenticado ou carimbo do tempo. O serviço gera assinatura criptográfica PDF, mas isso não permite afirmar qualificação ICP-Brasil. Antes do uso clínico, integrar validação de confiança/revogação, vínculo do certificado com o profissional e política do documento, e validar o resultado com uma ferramenta independente apropriada. Não foi realizado teste com um certificado real nem implantação do serviço remoto neste ambiente, que não possui credenciais administrativas para essas ações.

## Verificação executada

- `node tests/certificate-service.test.cjs`: senha, vínculo, permissões, CORS, chave correta em cadeia, assinatura criptográfica com certificado sintético verificada pelo OpenSSL e recusa de sobrescrever PDF já assinado. O OpenSSL usa `-noverify` porque o certificado é sintético: verifica integridade criptográfica, não confiança ICP-Brasil.
- `PLAYWRIGHT_MODULE=... node tests/browser/presential-signing.cjs`: fluxo presencial com dados sintéticos, alteração após assinatura, falha de arquivamento, hash e PDF válidos e ausência de duplicação após sucesso.
- `npm audit --omit=dev`: consulta de vulnerabilidades conhecidas das dependências; não substitui auditoria de segurança.
