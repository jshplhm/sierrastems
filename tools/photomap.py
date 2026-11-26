import re, sys, html, json, urllib.parse
s = open(sys.argv[1]).read()
out = {}
for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', s, re.S):
    tds = re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)
    if len(tds) < 4: continue
    text = [html.unescape(re.sub(r'<[^>]+>', '', t)).strip() for t in tds]
    item = text[1] if len(text) > 1 else ''
    m = re.search(r'drive\.google\.com/file/d/([\w-]+)', ''.join(tds))
    if item and m and item != 'Item': out[item] = m.group(1)
print(json.dumps(out, indent=1))
