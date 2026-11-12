#!/usr/bin/env python3
"""Agrupa o CSS inicial preservando ordem e caminhos relativos; sem dependências."""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
SOURCES = ('local-fonts.css', 'legacy-1.css', 'legacy-2.css', 'legacy-3.css',
 'patients-refresh.css', 'agenda-refresh.css', 'cloud.css', 'theme-mode.css',
 'nexodent-clean.css', 'nexodent-pages-unified.css', 'nexodent-layout-101.css',
 'nexodent-visual-103.css', 'nexodent-desktop-75.css', 'nexodent-4-abas-108.css')
def build():
 return '\n'.join('/* '+name+' */\n'+re.sub(r'^\s*@charset\s+[^;]+;','',(ROOT/'assets/css'/name).read_text(encoding='utf-8')).strip() for name in SOURCES)+'\n'
if __name__ == '__main__':
 (ROOT/'assets/css/app-shell.css').write_text(build(),encoding='utf-8')
 print(f'CSS inicial: {len(SOURCES)} arquivos reunidos em app-shell.css.')
