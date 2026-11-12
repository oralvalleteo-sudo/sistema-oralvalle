# Fotos pesadas — correção 277

## Causa confirmada no código

`private.read_row(..., true)` removia `thumb` da listagem de arquivos, inclusive quando a miniatura já estava salva. Para gerar cada miniatura novamente, o navegador lia o original inteiro via RPC em blocos de 65.536 caracteres. Além disso, `OralCloudData.file` colocava todos os arquivos na mesma fila, serializando seus downloads.

## Corrigido no aplicativo

- Até três arquivos independentes em leitura paralela, mantendo limite e validação de revisão, conta e vínculo do arquivo com paciente. Escritas continuam na fila existente. Se o contexto mudar durante a leitura, o resultado é recusado.
- Novas fotos da galeria: JPEG de até 450 KiB, maior lado no máximo 1.600 pixels, com geração de miniatura pequena. É uma otimização com perdas das novas imagens clínicas da galeria; não é um arquivo de preservação do original da câmera. Os arquivos existentes e os documentos assinados não foram recomprimidos ou alterados. Formatos não suportados pelo navegador não são convertidos automaticamente.
- Miniatura disponível imediatamente após envio na mesma galeria, mesmo antes da atualização do banco.
- Espaço reservado neutro enquanto miniaturas antigas carregam, sem ícone de imagem quebrada causado por endereço vazio.

## Ativação indispensável no Supabase

Aplicar `supabase/migrations/202611120012_photo_thumbnails.sql` no SQL Editor do projeto correto, após conferir a base clínica e o protocolo de arquivos já instalados. A migration é transacional e idempotente. Ela substitui a função de projeção de dados, preservando os campos de assinatura da migration 010 e as restrições existentes de leitura. Não apaga nem atualiza arquivos e não altera permissões de acesso.

A listagem passa a incluir a miniatura já existente somente para imagens, formatos JPEG/PNG/WebP e até 32 KiB de texto base64. O original e o registro privado de assinatura continuam fora da listagem. Esta mudança resolve o download desnecessário dos originais que já têm `thumb`. Fotos realmente antigas sem miniatura ainda precisam do primeiro download para gerar uma prévia; não foi executado backfill de produção.

**O banco remoto não foi alterado neste ambiente: não há credencial administrativa nem ferramenta conectada ao Supabase. Publicar o frontend não aplica SQL.** Sem aplicar essa migration, o benefício principal entre visitas ainda fica pendente.

## Validação

44 testes automatizados passaram. Testes novos verificam limite de três leituras paralelas, vínculo com paciente, recusa de mudança de conta e miniaturas no PostgreSQL isolado, sem expor o original, SVG, miniatura excessiva ou registro de assinatura. Seis roteiros de navegador passaram. Não foram enviados arquivos ou cadastros ao banco real.
