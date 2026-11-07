from playwright.sync_api import sync_playwright
import json,sys
S='/tmp/claude-0/-home-claude/944544ce-07bb-58b8-a2cb-0c75ed623fec/scratchpad'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(locale='de-DE')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://127.0.0.1:4173/index.html'); pg.wait_for_timeout(500)
    keys=pg.evaluate("""async()=>{const t=await (await fetch('index.html')).text(); const d=new DOMParser().parseFromString(t,'text/html'); const seen=new Set(); return i18nHtmlUnits(d.body).map(u=>u.key).filter(k=>!seen.has(k)&&seen.add(k));}""")
    json.dump(keys,open(S+'/html_keys.json','w'),ensure_ascii=False,indent=0)
    print(len(keys), sum(len(k.split()) for k in keys),'words', errs)
