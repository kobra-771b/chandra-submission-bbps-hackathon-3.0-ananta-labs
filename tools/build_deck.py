#!/usr/bin/env python3
"""Generate the Ananta Labs submission decks (static HTML, no build step needed to view).

Every string is written once as (en-US, en-UK, en-IN); a missing variant falls back to en-US.
The pages embed all three variants and a tiny script picks one from ``?lang=``.

    python tools/build_deck.py
"""
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "deck"
LOCALES = ("en-US", "en-UK", "en-IN")
HTML_LANG = {"en-US": "en-US", "en-UK": "en-GB", "en-IN": "en-IN"}  # valid BCP 47 for <html lang>


def v(us, uk=None, ind=None):
    uk = uk if uk is not None else us
    return {"en-US": us, "en-UK": uk, "en-IN": ind if ind is not None else uk}


def t(s):
    """Render a localised string as three sibling spans; CSS shows the active one."""
    if isinstance(s, str):
        return escape(s)
    return "".join(f'<span class="l l-{k}">{escape(s[k])}</span>' for k in LOCALES)


TITLE_OWNER = "Ananta Labs"
COPY = v("© 2026 Ananta Labs. All rights reserved.")
SUB = v("BBPS Hackathon 3.0 submission")
DATE = v("October 24, 2026", "24 October 2026", "24 October 2026")

# ---------------------------------------------------------------- content
# slide = (kind, heading, payload); kind: "lead" | "list" | "cards" | "steps"
# Facts come from the shipped sources: docs/Chandra-Specification.html, AndroidManifest.xml,
# chandra.py, EULA.txt and the Chandra Link source.
APPLICATION = {
    "slug": "application",
    "title": v("Application Slide Deck"),
    "tag": v("What Chandra is and how people use it"),
    "slides": [
        ("lead", v("Chandra"), v("A personal intelligence that talks, listens and works your computer, with your approval for each task. Serene at rest, capable in motion.")),
        ("list", v("The problem"), [
            v("Information is endless but our time is not, and getting things done on a computer still means a lot of clicking."),
            v("Cloud assistants need accounts and send your screen and files away by default."),
            v("Many people think and speak in Hindi, Hinglish or Indian English, and most assistants serve them poorly."),
        ]),
        ("cards", v("The Chandra family"), [
            (v("Chandra Desktop"), v("A voice-first assistant in its own quiet window for Windows 10 and 11. About 12.6 MB to download, installed per user with no administrator rights.", "A voice-first assistant in its own quiet window for Windows 10 and 11. About 12.6 MB to download, installed per user with no administrator rights.")),
            (v("Chandra for Android"), v("The same Chandra host running inside an Android app (version 1.0.1), with Android speech and text-to-speech.")),
            (v("Chandra Link"), v("Pairs the phone with the PC over your own Wi-Fi to ask Chandra, run PC actions and receive alerts. No account, no cloud.")),
        ]),
        ("cards", v("Talk to it"), [
            (v("Voice first"), v("Tap the moon, hold Space, or press Ctrl+Space. Chandra listens again after it answers, and you can talk over it.")),
            (v("English, Hindi, Hinglish"), v("Listening transcribes mixed sentences, and replies follow the language you used.")),
            (v("A natural voice"), v("Neural speech, sentence by sentence. Anything written for the eye, like code, links or formulas, is never read aloud.")),
            (v("Nebula"), v("A voice orb whose light follows the sound, over a calm aurora sky.")),
        ]),
        ("steps", v("Two taps for a task"), [
            v("Allow the task once, to start it."),
            v("Watch Chandra show each step as it works."),
            v("Accept the result before it finishes."),
            v("Deleting, moving or writing files, power, shell commands and anything that sends or pays always ask."),
        ]),
        ("list", v("Remembers and makes"), [
            v("Memory searched by meaning, not only keywords; it travels as .ananta files."),
            v("Playbooks: reusable routines instead of fragile automations."),
            v("Artifacts: code, HTML apps, documents, charts and tables, versioned and sandboxed."),
            v("Markdown and LaTeX maths drawn properly in every reply."),
        ]),
        ("list", v("Safe and private by design"), [
            v("No wiping commands, no typed card numbers or keys, and a brake at 45 clicks a minute."),
            v("No screen sensing while a password manager, bank or private window is in front."),
            v("Settings, chats, memory and keys stay on your computer. No analytics and no telemetry."),
            v("When there is no key or no internet, a local engine still answers."),
        ]),
        ("lead", v("Thank you"), v("Ananta Labs · BBPS Hackathon 3.0 submission")),
    ],
}

STACK = {
    "slug": "technology-stack",
    "title": v("Technology Stack"),
    "tag": v("What Chandra is built with"),
    "slides": [
        ("lead", v("Technology Stack"), v("Python at the core, a vanilla web interface, and three interchangeable brains.")),
        ("cards", v("Architecture"), [
            (v("Window"), v("pywebview on WinForms with Microsoft Edge WebView2 draws the page, the Nebula orb and the aurora.")),
            (v("Native bridge"), v("A JsApi channel carries computer control, screen look, listening and speech. While the window is open the HTTP /act route answers 403.")),
            (v("Host"), v("chandra.py: one Python file with a standard-library HTTP server on 127.0.0.1, the safeguards, approvals and tools.")),
            (v("Brains"), v("Claude, then Gemini, then a local engine, chosen automatically or forced with CHANDRA_BRAIN.")),
        ]),
        ("cards", v("Interface"), [
            (v("No framework"), v("Vanilla HTML, CSS and JavaScript modules, packed into the host by pack.py.")),
            (v("Graphics"), v("WebGL 1 shaders for the aurora sky and the Nebula orb, plus Canvas 2D effects.")),
            (v("Maths and text"), v("KaTeX 0.19 renders LaTeX as MathML; Markdown is rendered safely.")),
        ]),
        ("cards", v("AI and voice"), [
            (v("Claude"), v("Strongest reasoning when an Anthropic key is set.")),
            (v("Gemini"), v("Free-tier key unlocks screen vision, listening, natural voice and embedding recall.")),
            (v("Chandra Engine"), v("A local, offline, text-only engine built on OpenJarvis, used with no key or no internet.")),
        ]),
        ("list", v("Android"), [
            v("A native Java activity hosts a WebView, package labs.ananta.chandra, minimum Android 7.0 (API 24), target API 34."),
            v("Chaquopy runs Python 3.12 inside the app, serving the same host on 127.0.0.1."),
            v("A small shim swaps PC-only parts for Android clipboard, links, text-to-speech and speech recognition."),
        ]),
        ("list", v("Link, installer and safety"), [
            v("Chandra Link: Python with aiohttp, segno (QR) and zeroconf (discovery) over local Wi-Fi."),
            v("Chandra Setup: a native Windows installer with one LZMA payload and its own Python runtime, so nothing else must be installed."),
            v("Safeguards in the host: loopback only, approvals for sensitive actions, a click-rate brake, secret redaction in logs, sandboxed HTML artifacts."),
            v("Automated tests live in desktop/source/tests."),
        ]),
    ],
}

ROADMAP = {
    "slug": "commercialisation-roadmap",
    "title": v("Commercialization Roadmap", "Commercialisation Roadmap"),
    "tag": v("A proposed path from hackathon prototype to product"),
    "slides": [
        ("lead", v("Commercialization Roadmap", "Commercialisation Roadmap"), v("A draft plan by Ananta Labs. Phases and models are proposals to be validated, not commitments.")),
        ("steps", v("Phases"), [
            v("Phase 1 · Submit and harden: hackathon submission, keyless signed installers, bug fixes."),
            v("Phase 2 · Closed beta: Windows and Android users; feedback on voice, languages and safety prompts."),
            v("Phase 3 · Public launch: stable release, documentation, support channel."),
            v("Phase 4 · Expand: macOS and Linux builds, more languages, partner integrations."),
        ]),
        ("cards", v("Who it is for"), [
            (v("Individuals"), v("People who want a private, voice-first assistant that can do real work on their computer.")),
            (v("Hindi and Hinglish speakers"), v("A first-class experience in the languages many people actually speak.")),
            (v("Small teams"), v("Shared PCs and offices that need simple, local-first automation.")),
        ]),
        ("cards", v("Revenue models under evaluation"), [
            (v("Free core, paid extras"), v("Core Chandra free; advanced playbooks, multi-device and Link features paid.")),
            (v("Licensing"), v("Per-seat or per-organization licences for teams.", "Per-seat or per-organisation licences for teams.")),
            (v("Partnerships"), v("Co-branded or bundled distribution with hardware and software partners.")),
        ]),
        ("list", v("Pricing and cost notes"), [
            v("Prices will be set per region after beta feedback (US in $, UK in £, India in ₹).",
              "Prices will be set per region after beta feedback (US in $, UK in £, India in ₹).",
              "Prices will be set per region after beta feedback (India in ₹, with USD and GBP for export)."),
            v("Local-first design means no hosting cost for user data. Cloud AI costs are the user's own keys, or a future managed plan."),
            v("Trust, privacy and ease of setup are the main differentiators."),
        ]),
        ("list", v("Risks and mitigations"), [
            v("API keys must never ship inside public installers: use keyless builds and per-user setup only."),
            v("Third-party terms: AI providers' usage terms, and the Commons Clause on bundled UI components, which allows use inside an application but not resale of the components themselves."),
            v("Dependence on external AI services: keep the local engine as a fallback."),
            v("Windows-first: validate on real PCs and phones during beta, then add other platforms."),
            v("Intellectual property: all work © Ananta Labs; third-party licences are tracked in LICENSES.txt."),
        ]),
    ],
}

DECKS = [APPLICATION, STACK, ROADMAP]
CHROME = {
    "home": v("All decks"), "lang": v("Language"),
    "prev": v("Previous"), "next": v("Next"),
    "index_title": v("Ananta Labs · Submission decks"),
    "index_tag": v("Pick a deck. Your language choice travels with you."),
    "open": v("Open deck"),
}

# ---------------------------------------------------------------- templates
HEAD = """<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="Ananta Labs submission for BBPS Hackathon 3.0">
<link rel="stylesheet" href="{up}assets/deck.css">
<script defer src="{up}assets/deck.js"></script>
</head>
"""


def switcher():
    btns = "".join(f'<a class="lang-btn" data-set-lang="{k}" href="?lang={k}">{k}</a>' for k in LOCALES)
    return f'<nav class="lang" aria-label="Language"><span>{t(CHROME["lang"])}:</span>{btns}</nav>'


def footer(up):
    return (f'<footer><span>{t(COPY)}</span><span>{t(SUB)} · {t(DATE)}</span>'
            f'<a href="{up}" data-keep-lang>{t(CHROME["home"])}</a></footer>')


def slide(i, n, s):
    kind, heading, body = s
    h = f"<h2>{t(heading)}</h2>" if kind != "lead" else f"<h1>{t(heading)}</h1>"
    if kind == "lead":
        inner = f'<p class="lead">{t(body)}</p>'
    elif kind == "list":
        inner = "<ul>" + "".join(f"<li>{t(x)}</li>" for x in body) + "</ul>"
    elif kind == "steps":
        inner = "<ol>" + "".join(f"<li>{t(x)}</li>" for x in body) + "</ol>"
    else:
        inner = '<div class="cards">' + "".join(
            f'<article><h3>{t(a)}</h3><p>{t(b)}</p></article>' for a, b in body) + "</div>"
    return f'<section class="slide{" cover" if kind == "lead" else ""}" id="s{i + 1}">{h}{inner}<span class="n">{i + 1} / {n}</span></section>\n'


def deck_page(d):
    n = len(d["slides"])
    body = "".join(slide(i, n, s) for i, s in enumerate(d["slides"]))
    return (HEAD.format(title=f'{d["title"]["en-US"]} · {TITLE_OWNER}', up="../") +
            f'<body data-deck="{d["slug"]}">\n<header><strong>{TITLE_OWNER}</strong>{switcher()}</header>\n'
            f'<main>\n{body}</main>\n'
            f'<div class="nav"><button id="prev">{t(CHROME["prev"])}</button><button id="next">{t(CHROME["next"])}</button></div>\n'
            f'{footer("../")}\n</body>\n</html>\n')


def index_page():
    cards = "".join(
        f'<article><h3>{t(d["title"])}</h3><p>{t(d["tag"])}</p>'
        f'<a class="btn" href="{d["slug"]}/" data-keep-lang>{t(CHROME["open"])}</a></article>' for d in DECKS)
    return (HEAD.format(title=f'{CHROME["index_title"]["en-US"]}', up="") +
            f'<body data-deck="index">\n<header><strong>{TITLE_OWNER}</strong>{switcher()}</header>\n'
            f'<main class="home"><h1>{t(CHROME["index_title"])}</h1><p class="lead">{t(CHROME["index_tag"])}</p>'
            f'<div class="cards">{cards}</div></main>\n{footer("")}\n</body>\n</html>\n')


CSS = """:root{--bg:#fff;--fg:#14213d;--mut:#5a6578;--card:#f3f5fa;--acc:#3b5bdb;--line:#d9deea}
@media (prefers-color-scheme:dark){:root{--bg:#0e1424;--fg:#e8ecf7;--mut:#9aa6c0;--card:#18213a;--acc:#8fa6ff;--line:#2a3556}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header,footer{display:flex;flex-wrap:wrap;gap:.75rem 1.5rem;align-items:center;justify-content:space-between;padding:.75rem 16px;border-bottom:1px solid var(--line)}
footer{border:0;border-top:1px solid var(--line);color:var(--mut);font-size:.85rem}
a{color:var(--acc)}
.lang{display:flex;gap:.4rem;align-items:center;color:var(--mut);font-size:.9rem}
.lang-btn{padding:.2rem .6rem;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--fg)}
.lang-btn[aria-current=true]{background:var(--acc);color:var(--bg);border-color:var(--acc)}
.l{display:none}
html[data-lang=en-US] .l-en-US,html[data-lang=en-UK] .l-en-UK,html[data-lang=en-IN] .l-en-IN,html:not([data-lang]) .l-en-US{display:contents}
.slide{min-height:calc(100vh - 8rem);padding:3rem 16px;max-width:60rem;margin:0 auto;position:relative;border-bottom:1px dashed var(--line)}
.slide.cover{display:flex;flex-direction:column;justify-content:center}
h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.1;margin:.2em 0}h2{font-size:clamp(1.5rem,4vw,2.2rem);margin:0 0 1rem}h3{margin:.2rem 0}
.lead{font-size:1.25rem;color:var(--mut);max-width:40rem}
ul,ol{padding-left:1.3rem}li{margin:.5rem 0}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:1rem}
.cards article{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1rem 1.2rem}
.cards p{margin:.3rem 0 0;color:var(--mut)}
.btn{display:inline-block;margin-top:.6rem;padding:.4rem .9rem;border-radius:8px;background:var(--acc);color:var(--bg);text-decoration:none}
.n{position:absolute;left:16px;bottom:1rem;color:var(--mut);font-size:.8rem}
.home{max-width:60rem;margin:0 auto;padding:3rem 16px;min-height:calc(100vh - 8rem)}
.nav{position:fixed;right:16px;bottom:3.6rem;display:flex;gap:.4rem}
.nav button{padding:.4rem .8rem;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}
@media print{header,footer,.nav{display:none}.slide{page-break-after:always;border:0}}
"""

JS = """(function(){
  var OK={'en-US':'en-US','en-UK':'en-UK','en-GB':'en-UK','en-IN':'en-IN'};
  var HTML={'en-US':'en-US','en-UK':'en-GB','en-IN':'en-IN'};
  var key=(new URLSearchParams(location.search).get('lang')||'').toLowerCase();
  var lang='en-US';
  Object.keys(OK).forEach(function(k){if(k.toLowerCase()===key)lang=OK[k];});
  var root=document.documentElement;
  root.setAttribute('data-lang',lang);root.setAttribute('lang',HTML[lang]);
  function carry(){
    document.querySelectorAll('a[data-keep-lang]').forEach(function(a){
      var u=new URL(a.getAttribute('href'),location.href);u.searchParams.set('lang',lang);
      a.setAttribute('href',u.pathname+u.search+u.hash);
    });
    document.querySelectorAll('[data-set-lang]').forEach(function(b){
      var l=b.getAttribute('data-set-lang');
      b.setAttribute('aria-current',String(l===lang));
      b.setAttribute('href','?lang='+l+location.hash);
    });
  }
  document.addEventListener('DOMContentLoaded',function(){
    carry();
    var s=[].slice.call(document.querySelectorAll('.slide')),i=0;
    function go(d){if(!s.length)return;i=Math.max(0,Math.min(s.length-1,i+d));s[i].scrollIntoView({behavior:'smooth'});}
    var p=document.getElementById('prev'),n=document.getElementById('next');
    if(p)p.onclick=function(){go(-1)};if(n)n.onclick=function(){go(1)};
    document.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' ')go(1);
      if(e.key==='ArrowLeft'||e.key==='PageUp')go(-1);
    });
  });
})();
"""


def main():
    (OUT / "assets").mkdir(parents=True, exist_ok=True)
    (OUT / "assets" / "deck.css").write_text(CSS, encoding="utf-8")
    (OUT / "assets" / "deck.js").write_text(JS, encoding="utf-8")
    (OUT / "index.html").write_text(index_page(), encoding="utf-8")
    for d in DECKS:
        (OUT / d["slug"]).mkdir(exist_ok=True)
        (OUT / d["slug"] / "index.html").write_text(deck_page(d), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
