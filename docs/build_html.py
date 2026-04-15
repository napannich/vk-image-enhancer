#!/usr/bin/env python3
"""Convert markdown docs to styled self-contained HTML (for Print→PDF)."""
import os
import sys
from pathlib import Path
import markdown

STYLE = """
<style>
@page { size: A4; margin: 20mm 18mm; }
body {
  font-family: -apple-system, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
  font-size: 11pt; line-height: 1.55; color: #1a1a1a; max-width: 780px; margin: 30px auto; padding: 0 20px;
}
h1 { font-size: 20pt; margin: 0 0 18px; border-bottom: 2px solid #0077ff; padding-bottom: 8px; }
h2 { font-size: 15pt; margin: 24px 0 10px; color: #004a99; page-break-after: avoid; }
h3 { font-size: 13pt; margin: 18px 0 8px; color: #0055aa; page-break-after: avoid; }
p, li { margin: 6px 0; }
ul, ol { padding-left: 22px; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; page-break-inside: avoid; }
th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: #f0f5ff; font-weight: 600; }
code { background: #f4f4f8; padding: 1px 6px; border-radius: 3px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 0.92em; }
pre { background: #f6f8fa; border: 1px solid #e4e8ee; padding: 12px 14px; border-radius: 6px; font-size: 9.5pt; overflow-x: auto; page-break-inside: avoid; }
pre code { background: transparent; padding: 0; }
blockquote { border-left: 3px solid #0077ff; padding: 4px 12px; margin: 12px 0; color: #444; background: #f8faff; }
hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
strong { color: #0a0a0a; }
</style>
"""

HTML = """<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>{title}</title>{style}</head><body>{body}</body></html>"""

def convert(md_path: Path, out_path: Path):
    text = md_path.read_text(encoding='utf-8')
    html = markdown.markdown(text, extensions=['tables', 'fenced_code', 'sane_lists'])
    title = md_path.stem.replace('_', ' ').title()
    out_path.write_text(HTML.format(title=title, style=STYLE, body=html), encoding='utf-8')
    print(f"[ok] {md_path.name} -> {out_path.name}")

def main():
    docs = Path(__file__).parent
    for md in ['report.md', 'presentation.md', 'curator_feedback.md', 'submission.md']:
        src = docs / md
        if src.exists():
            convert(src, docs / md.replace('.md', '.html'))

if __name__ == '__main__':
    main()
