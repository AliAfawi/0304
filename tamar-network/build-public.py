#!/usr/bin/env python3
"""Build the public, read-only copy of the site for official hosting.

The public copy has no admin entry point at all (initAdmin is never called),
ships a strict Content-Security-Policy, and comes with security headers for
static hosts (Netlify / Cloudflare Pages style `_headers` file).

Usage:  python3 build-public.py [state.json] [--endpoint https://script.google.com/macros/s/.../exec]
  state.json (optional): content exported from the live editor to bake in.
  --endpoint (optional): the forms Apps Script URL, if it isn't already in the state.
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "public")
src = open(os.path.join(HERE, "index.html"), encoding="utf-8").read()

CSP = ("default-src 'none'; script-src 'self' 'unsafe-inline'; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src https://fonts.gstatic.com; img-src 'self' data:; "
       "connect-src https://script.google.com https://script.googleusercontent.com; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'")

head_extra = (
    f'<meta http-equiv="Content-Security-Policy" content="{CSP}">\n'
    '<meta name="referrer" content="strict-origin-when-cross-origin">\n'
    '<meta property="og:title" content="רשת תמר – מחוללים שינוי">\n'
    '<meta property="og:description" content="רשת החינוך תמר בנגב: בתי ספר, תוצאות בוגרים, תכניות, משרות והרשמה.">\n'
    '<meta property="og:type" content="website">\n'
    '<meta property="og:image" content="assets/tamar-logo.jpg">\n'
)

out = src.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + head_extra, 1)
assert "\ninitAdmin();" in out
out = out.replace("\ninitAdmin();", "\n/* public build: no admin */", 1)

args = sys.argv[1:]
if "--endpoint" in args:
    i = args.index("--endpoint"); ep = args[i + 1]; del args[i:i + 2]
    assert re.fullmatch(r"https://script\.google\.com/macros/s/[\w-]+/exec", ep), "bad endpoint"
    out = out.replace('{formEndpoint:"",', '{formEndpoint:"%s",' % ep, 1)
if args:
    state = json.load(open(args[0], encoding="utf-8"))
    blob = json.dumps(state, ensure_ascii=False).replace("<", "\\u003c")
    out = out.replace('<script type="application/json" id="site-state">null</script>',
                      f'<script type="application/json" id="site-state">{blob}</script>', 1)

shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(os.path.join(OUT, "assets"))
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(out)
shutil.copy(os.path.join(HERE, "assets", "tamar-logo.jpg"), os.path.join(OUT, "assets"))
open(os.path.join(OUT, "_headers"), "w").write(
    "/*\n"
    f"  Content-Security-Policy: {CSP}; frame-ancestors 'none'\n"
    "  X-Frame-Options: DENY\n"
    "  X-Content-Type-Options: nosniff\n"
    "  Referrer-Policy: strict-origin-when-cross-origin\n"
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()\n"
    "  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload\n"
    "  Cross-Origin-Opener-Policy: same-origin\n")
open(os.path.join(OUT, "robots.txt"), "w").write("User-agent: *\nAllow: /\n")
print("built", OUT)
