"""EN_HTML nach Schlüssel abgleichen: vorhandene Übersetzungen behalten, neue Schlüssel aus new_html_en.json ergänzen,
fehlende melden. Ersetzt die index-basierte Zuordnung (bricht bei eingefügten Einheiten)."""
import json, sys
S = '/tmp/claude-0/-home-claude/944544ce-07bb-58b8-a2cb-0c75ed623fec/scratchpad'
keys = json.load(open(S + '/html_keys.json', encoding='utf-8'))
old = json.load(open(S + '/en_html.json', encoding='utf-8'))
keep = set(json.load(open(S + '/en_html_keep.json', encoding='utf-8')))
try: add = json.load(open(S + '/new_html_en.json', encoding='utf-8'))
except FileNotFoundError: add = {}
out, k2, missing = {}, [], []
for k in keys:
    if k in add: v = add[k]
    elif k in old: v = old[k]
    elif k in keep: v = k
    else: missing.append(k); continue
    if v == k: k2.append(k)
    else: out[k] = v
json.dump(out, open(S + '/en_html.json', 'w', encoding='utf-8'), ensure_ascii=False)
json.dump(k2, open(S + '/en_html_keep.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('übersetzt', len(out), 'gleich', len(k2), 'fehlend', len(missing))
for m in missing: print('MISSING|' + m)
