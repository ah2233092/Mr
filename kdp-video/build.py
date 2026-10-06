"""Fill template.html with icons and the voice timeline -> build/index.html."""
import json
import re

ICON_DIR = "node_modules/lucide-static/icons"
CURSOR = ('<svg viewBox="0 0 24 24" width="64" height="64"><path d="M4 2l15 11.5-6.6 1.1 3.9 7.3-3 1.6-3.9-7.4L4 21z" '
          'fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>')


def icon(m):
    svg = open(f"{ICON_DIR}/{m.group(1)}.svg").read()
    svg = svg[svg.index("<svg"):]
    svg = re.sub(r'\s(class|width|height)="[^"]*"', "", svg, count=3)
    return re.sub(r"\s+", " ", svg.replace("<svg", '<svg class="ic"', 1)).strip()


html = open("template.html").read()
html = re.sub(r"\{\{i:([a-z0-9-]+)\}\}", icon, html)
html = html.replace("{{cursor}}", CURSOR)
html = html.replace("node_modules/", "../node_modules/")
html = html.replace("__TIMELINE__", json.dumps(json.load(open("build/timeline.json")), ensure_ascii=False))
open("build/index.html", "w").write(html)
print("ok")
