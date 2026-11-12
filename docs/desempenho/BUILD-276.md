# Abertura e fotos — build 276

- CSS inicial: 14 requisições substituídas por uma, preservando a ordem, os estilos e os caminhos de fontes. Regerar com `python3 scripts/build_shell_css.py` ao editar qualquer fonte listada nesse script. A publicação confere que o arquivo gerado está atualizado.
- Cache do Service Worker: somente assets públicos versionados e da própria origem/escopo. Não intercepta HTML, endpoints do Supabase, arquivos JSON, métodos de escrita ou requisições com Authorization. Cache não guarda fotos de pacientes. Arquivos sem versão continuam com comportamento HTTP normal. Conteúdo marcado private/no-store não é armazenado.
- Registro do Service Worker corrigido para o subdiretório do sistema no Pages. Assets são reaproveitados nas visitas após instalação e ativação; a primeira visita ainda precisa baixá-los.
- Fotos antigas: geração de miniaturas apenas perto da área visível, limite de duas tarefas em paralelo e reutilização temporária em memória de miniaturas entre galerias da mesma pessoa/usuário/clínica. Não grava novos arquivos no prontuário nem altera imagens originais existentes.
- Decodificação de imagens assíncrona na galeria, seleção e ampliação. Downloads originais continuam disponíveis ao abrir a foto.

## Evidência local

`tests/browser/photo-performance.cjs`: galeria sintética com 60 fotos antigas, viewport 500×500. Foram solicitados 5 originais na abertura e 12 no total após rolar diretamente à foto 56, em vez de solicitar toda a galeria antecipadamente. As imagens sintéticas são pequenas; a medição é de quantidade de solicitações, não de segundos economizados com fotos reais.

42 testes automatizados passaram, incluindo limites do cache; seis roteiros de navegador passaram, incluindo agenda/pacientes, chat móvel, navegação, assinatura presencial, privacidade e fotos. O artefato público foi validado.

Isto reduz trabalho e requisições na abertura/retorno. Não é certificação para 500 usuários simultâneos. Latência real ainda depende de conexão, tamanho dos arquivos e banco. Não foram alterados Supabase de produção, revisão global, políticas de acesso ou algoritmos de assinatura.
