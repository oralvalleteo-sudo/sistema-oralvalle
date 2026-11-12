#!/usr/bin/env python3
"""Confere as páginas/recursos locais essenciais antes do upload ao Pages."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else '_site').resolve()
missing = []
checked = 0
class Dependencies(HTMLParser):
    def __init__(self, page):
        super().__init__()
        self.page = page
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        url = values.get('src') if tag in ('script', 'img', 'iframe') else values.get('href') if tag == 'link' else None
        if not url or url.startswith(('#', 'data:', 'blob:', '//')):
            return
        parsed = urlsplit(url)
        if parsed.scheme or not parsed.path:
            return
        global checked
        checked += 1
        path = (self.page.parent / unquote(parsed.path)).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            missing.append(f'{self.page.relative_to(root)} → {url}')
for required in ('index.html', 'crm/index.html', 'crm/js/crm.js', 'assets/js/supabase/client.js', 'comunicacao/index.html', 'comunicacao/chat.js', 'assets/js/chat-widget.js', 'assets/js/chat-badge.js', 'assets/css/chat-widget.css', 'assets/js/notification-sound.js', 'assets/js/features/presential-signing.js', 'legal/privacidade.html', 'legal/cookies.html', 'legal/direitos.html', 'legal/termos.html', 'legal/catalog.json', 'legal/config.js', 'legal/acceptance.js', 'legal/rights.js', 'assets/css/local-fonts.css', 'assets/fonts/LICENSE-Figtree.txt'):
    if not (root / required).is_file():
        missing.append(required)
for relative in ('index.html', 'crm/index.html', 'admin/index.html', 'integracoes/index.html', 'comunicacao/index.html', 'legal/privacidade.html', 'legal/cookies.html', 'legal/direitos.html', 'legal/termos.html'):
    page = root / relative
    if page.is_file():
        Dependencies(page).feed(page.read_text(encoding='utf-8'))
if missing:
    raise SystemExit('Recursos ausentes no artefato:\n' + '\n'.join(missing))
print(f'Publicação validada: CRM presente e {checked} referências locais verificadas.')
