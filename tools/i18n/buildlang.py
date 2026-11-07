import json,os
S=os.path.dirname(os.path.abspath(__file__))
t=json.load(open(S+'/en_content.json',encoding='utf-8'))
if os.path.exists(S+'/en_extra.json'): t.update(json.load(open(S+'/en_extra.json',encoding='utf-8')))
h=json.load(open(S+'/en_html.json',encoding='utf-8')) if os.path.exists(S+'/en_html.json') else {}
keep=json.load(open(S+'/en_html_keep.json',encoding='utf-8')) if os.path.exists(S+'/en_html_keep.json') else []
out='/* Englische Texte für Tagwerk. Schlüssel = deutscher Originaltext (siehe i18n.js). */\n'
out+='const EN_TEXT = '+json.dumps(t,ensure_ascii=False,indent=0)+';\n'
out+='const EN_HTML = '+json.dumps(h,ensure_ascii=False,indent=0)+';\n'
out+='const EN_HTML_KEEP = '+json.dumps(keep,ensure_ascii=False)+';\n'
open('/home/claude/kettlebell-trackrr/lang-en.js','w',encoding='utf-8').write(out)
print(len(t),len(h),len(keep))
