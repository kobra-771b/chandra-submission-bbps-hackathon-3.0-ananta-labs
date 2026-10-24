/* ============ Options: interface switches and credits ============ */
(function () {
"use strict";
const prefs = document.getElementById("prefs");
if (!prefs) return;
const box = document.createElement("div");
box.id = "uiset";
const cur = window.ChandraCursor;
const avail = cur && cur.available;
const skin = () => document.documentElement.dataset.skin === "classic" ? "classic" : "starlight";
box.innerHTML = `<div class="grp">Interface</div>
<div class="list g"><div class="row"><span class="f">Style<br><span class="mu sm">Modern: today's Chandra. Legacy: Chandra's original look, with the coloured moon.</span></span><span class="skins" role="radiogroup" aria-label="Style"><button class="chip" data-ui="modern" role="radio">Modern</button><button class="chip" data-ui="legacy" role="radio">Legacy</button></span></div><div class="row"><span class="f">Colour<br><span class="mu sm">A colour for either style. Change it whenever you like.</span></span><span id="accbox"></span></div></div>
<div class="list g"><div class="row"><span class="f">Look<br><span class="mu sm">Starlight: deep blue, an ASCII sky and starlight. Classic: Chandra's original black.</span></span><span class="skins" role="radiogroup" aria-label="Look"><button class="chip" data-skin="starlight" role="radio">Starlight</button><button class="chip" data-skin="classic" role="radio">Classic</button></span></div><div class="row"><span class="f">Target cursor<br><span class="mu sm">${avail ? "In previews of apps Chandra makes, a spinning reticle locks onto each part and names its line. Click to use; Shift + right-click opens the source there. Elsewhere Chandra keeps its own pointers." : "Needs a mouse or trackpad, so it is off on this device."}</span></span><button class="sw" role="switch" id="pcur" aria-checked="${!!(cur && cur.on)}" aria-label="Target cursor"${avail ? "" : " disabled"}></button></div></div>
<div class="grp">Credits</div>
<div class="credits mu sm">
<p><b>Chandra</b> · Ananta Labs. © 2026 Ananta Labs. All rights reserved.</p>
<p>The target cursor (Target Cursor), the ASCII sky and corona (Gradient ASCII) and the placeholder art (Grainient) are ported from <b>React Bits</b> by David Haz, reactbits.dev, used under its MIT + Commons Clause licence. Copyright © 2026 David Haz. The speaking and listening blob is Chandra's own shader, written to its Aurora values.</p>
<p>Chart colours follow a palette validated for colour-blind readers on Chandra's black.</p>
<p>Full notices: THIRD-PARTY-NOTICES.md beside Chandra Desktop.</p>
</div>`;
prefs.append(box);
const ab = box.querySelector("#accbox"); if (ab && window.ChandraUI) { ab.innerHTML = ChandraUI.swatches(); ChandraUI.bindSwatches(ab); }
const paintUI = () => box.querySelectorAll("[data-ui]").forEach(b => { const on = (window.ChandraUI ? ChandraUI.mode : "modern") === b.dataset.ui; b.setAttribute("aria-pressed", on); b.setAttribute("aria-checked", on); });
box.querySelectorAll("[data-ui]").forEach(b => b.addEventListener("click", () => { if (window.ChandraUI) ChandraUI.set(b.dataset.ui); paintUI(); try { window.toast(b.dataset.ui === "legacy" ? "Legacy style" : "Modern style"); } catch (_) {} }));
paintUI();
const paintSkins = () => box.querySelectorAll("[data-skin]").forEach(b => { const on = b.dataset.skin === skin(); b.setAttribute("aria-pressed", on); b.setAttribute("aria-checked", on); });
box.querySelectorAll("[data-skin]").forEach(b => b.addEventListener("click", () => {
  if (window.ChandraUI && ChandraUI.mode === "legacy") { ChandraUI.set("modern"); paintUI(); }
  if (window.ChandraSkin) window.ChandraSkin.set(b.dataset.skin); else document.documentElement.dataset.skin = b.dataset.skin;
  paintSkins();
  try { window.toast(b.dataset.skin === "classic" ? "Classic look" : "Starlight look"); } catch (_) {}
}));
paintSkins();
const sw = box.querySelector("#pcur");
sw.addEventListener("click", () => {
  if (!cur || sw.disabled) return;
  const on = sw.getAttribute("aria-checked") !== "true";
  cur.set(on); sw.setAttribute("aria-checked", !!cur.on);
  try { window.toast(on ? "Target cursor on" : "Target cursor off"); } catch (_) {}
});
})();
