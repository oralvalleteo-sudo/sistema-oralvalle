#!/usr/bin/env python3
"""Monta o artefato público do Pages, incluindo os módulos acessados por iframe."""
from pathlib import Path
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / '_site').resolve()
DIRECTORIES = ('assets', 'admin', 'crm', 'integracoes', 'ativar-teste', 'solicitar-teste', 'assinatura', 'comunicacao')
ROOT_FILES = ('index.html', 'nexodent-version.json', 'sw.js', 'manifest.webmanifest', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'favicon.ico', 'favicon.svg', 'favicon-32.png', 'whatsapp-callback.html', 'CNAME')
EXTENSIONS = {'.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.webmanifest', '.json', '.mp3', '.wav', '.ogg', '.pdf'}
REQUIRED = ('index.html', 'nexodent-version.json', 'crm/index.html', 'crm/js/crm.js', 'crm/js/integracao.js', 'assets/js/supabase/config.js', 'assets/js/supabase/client.js')

for relative in REQUIRED:
    if not (ROOT / relative).is_file():
        raise SystemExit('Arquivo obrigatório ausente: ' + relative)
if DESTINATION.exists():
    raise SystemExit('Use uma pasta de saída inexistente para evitar misturar versões: ' + str(DESTINATION))
files = [ROOT / name for name in ROOT_FILES if (ROOT / name).is_file()]
for directory in DIRECTORIES:
    folder = ROOT / directory
    if folder.is_dir():
        for file in folder.rglob('*'):
            if file.is_symlink():
                raise SystemExit('Link simbólico não permitido no artefato: ' + str(file))
            if file.is_file() and file.suffix.lower() in EXTENSIONS and not any(part.startswith('.') for part in file.relative_to(ROOT).parts) and not (file.suffix.lower()=='.json' and 'backup' in file.name.lower()):
                files.append(file)
DESTINATION.mkdir(parents=True)
for source in files:
    relative = source.relative_to(ROOT)
    target = DESTINATION / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.suffix == '.html':
        # Caminhos absolutos /assets e /admin quebram no subdiretório do GitHub Pages.
        prefix = '../' * len(relative.parent.parts)
        text = source.read_text(encoding='utf-8')
        text = re.sub(r'((?:src|href)=["\'])/(?!/)', lambda match: match.group(1) + (prefix or './'), text)
        target.write_text(text, encoding='utf-8')
    else:
        shutil.copyfile(source, target)
    target.chmod(0o644)
(DESTINATION / '.nojekyll').touch()
print(f'Artefato criado: {len(files)} arquivos; CRM e módulos públicos incluídos.')
