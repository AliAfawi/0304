#!/usr/bin/env python3
"""Build the public, read-only copy of the site for official hosting.

The public copy has no admin entry point at all (initAdmin is never called),
ships a strict Content-Security-Policy, and comes with security headers for
static hosts (Netlify / Cloudflare Pages style `_headers` file).

Usage:  python3 build-public.py [state.json] [--endpoint URL] [--site-url https://example.org] [--cf-analytics TOKEN]
  state.json (optional): content exported from the live editor to bake in.
  --endpoint (optional): the forms Apps Script URL, if it isn't already in the state.
  --site-url (optional): the official address; adds canonical, og:url, sitemap.xml and structured data.
  --cf-analytics (optional): Cloudflare Web Analytics token (cookieless, privacy-friendly).
  --firebase (optional): firebase-config.json (the public web config). Turns on live content,
    the Firestore inbox and admin sign-in by email link (#admin). See firebase/README.md.
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "public")
src = open(os.path.join(HERE, "index.html"), encoding="utf-8").read()

CSP = ("default-src 'none'; script-src 'self' 'unsafe-inline'; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src https://fonts.gstatic.com; img-src 'self' data:; "
       "connect-src https://script.google.com https://script.googleusercontent.com; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'")

CSP_META = "__CSP__"
head_extra = (
    f'<meta http-equiv="Content-Security-Policy" content="{CSP_META}">\n'
    '<meta name="referrer" content="strict-origin-when-cross-origin">\n'
    '<meta property="og:title" content="רשת תמר – מחוללים שינוי">\n'
    '<meta property="og:description" content="רשת החינוך תמר בנגב: בתי ספר, תוצאות בוגרים, תכניות, משרות והרשמה.">\n'
    '<meta property="og:type" content="website">\n'
    '<meta property="og:image" content="assets/tamar-logo.jpg">\n'
)

def take(flag):
    if flag in sys.argv:
        i = sys.argv.index(flag); v = sys.argv[i + 1]; del sys.argv[i:i + 2]; return v
    return ""
site_url = take("--site-url").rstrip("/")
fb_file = take("--firebase")
fb_cfg = None
if fb_file:
    fb_cfg = json.load(open(fb_file, encoding="utf-8"))
    allowed = {"apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "measurementId"}
    assert set(fb_cfg) <= allowed and all(isinstance(v, str) and re.fullmatch(r"[\w.:/-]+", v) for v in fb_cfg.values()), "bad firebase config"
    CSP = CSP.replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' https://www.gstatic.com")
    CSP = CSP.replace("connect-src ", "connect-src https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com ")
    CSP += "; frame-src https://" + fb_cfg.get("authDomain", "") 
cf_token = take("--cf-analytics")
if site_url:
    assert re.fullmatch(r"https://[a-z0-9.-]+", site_url), "bad site url"
    head_extra += f'<link rel="canonical" href="{site_url}/">\n<meta property="og:url" content="{site_url}/">\n'
ld = {"@context": "https://schema.org", "@type": "EducationalOrganization", "name": "רשת תמר – מחוללים שינוי",
      "alternateName": ["Tamar Network", "شبكة تمار"], "foundingDate": "2015",
      "subOrganization": {"@type": "HighSchool", "name": "בית ספר אלסנא למצוינות מדעית", "alternateName": ["مدرسة السنا للتفوّق العلمي", "Al-Sana School for Scientific Excellence"],
                          "address": {"@type": "PostalAddress", "streetAddress": "רחוב העתיד, פארק עידן הנגב", "addressLocality": "רהט", "addressCountry": "IL"}}}
if site_url:
    ld["url"] = site_url + "/"; ld["logo"] = site_url + "/assets/tamar-logo.jpg"
head_extra += '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace("<", "\\u003c") + '</script>\n'
if cf_token:
    assert re.fullmatch(r"[0-9a-f]{32}", cf_token), "bad analytics token"
    CSP = CSP.replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com")
    CSP = CSP.replace("connect-src ", "connect-src https://cloudflareinsights.com ")
out = src.replace('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + head_extra.replace(CSP_META, CSP), 1)
if cf_token:
    head, sep, tail = out.rpartition("</body>")
    out = head + f'<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{{"token":"{cf_token}"}}\'></script>\n' + sep + tail

if fb_cfg:
    assert "const FB_CONFIG = null;" in out
    out = out.replace("const FB_CONFIG = null;", "const FB_CONFIG = " + json.dumps(fb_cfg) + ";", 1)
args = sys.argv[1:]
if "--endpoint" in args:
    i = args.index("--endpoint"); ep = args[i + 1]; del args[i:i + 2]
    assert re.fullmatch(r"https://script\.google\.com/macros/s/[\w-]+/exec", ep), "bad endpoint"
    assert 'Object.assign({formEndpoint:"",' in out
    out = out.replace('Object.assign({formEndpoint:"",', 'Object.assign({formEndpoint:"%s",' % ep, 1)
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
open(os.path.join(OUT, "robots.txt"), "w").write("User-agent: *\nAllow: /\n" + (f"Sitemap: {site_url}/sitemap.xml\n" if site_url else ""))
if site_url:
    open(os.path.join(OUT, "sitemap.xml"), "w").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  <url><loc>{site_url}/</loc></url>\n</urlset>\n')
print("built", OUT)
