/* Where you are: a small pill on Home ("Pune, IN") that opens a card to find your location again or type a city.
   The finding and the saving live in the page (ChandraPlace); this only draws it. */
(() => {
  const host = document.getElementById("hstat");
  if (!host) return;
  const pin = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/></svg>';
  const pill = document.createElement("button");
  pill.id = "place"; pill.className = "g"; pill.type = "button"; pill.setAttribute("aria-haspopup", "dialog"); pill.setAttribute("aria-expanded", "false");
  const box = document.createElement("div");
  box.id = "placebox"; box.className = "g"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Location");
  box.innerHTML = '<p class="mu sm" id="plnote"></p><div class="prow"><input class="tx" id="plcity" placeholder="City, for example Pune" autocomplete="off" aria-label="City"><button class="btn p" id="plset">Set</button></div><div class="prow"><button class="btn" id="plgo">Find my location</button></div><p class="mu sm" id="plerr" aria-live="polite"></p>';
  host.append(pill); document.body.append(box);
  const P = () => window.ChandraPlace, $ = s => box.querySelector(s);
  function draw() {
    const l = P() && P().loc;
    pill.innerHTML = pin + "<span>" + (l ? (l.name || "Current location") : "Finding you…").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) + "</span>";
    pill.title = "Change location";
    $("#plnote").textContent = !l ? "Looking for your location." : l.auto ? "Found automatically (" + (l.src === "gps" ? "GPS" : "network") + "). Type a city to use another place." : "Set by you. Tap Find my location to go back to automatic.";
  }
  function place() { const r = pill.getBoundingClientRect(); box.style.left = Math.max(8, Math.min(innerWidth - 328, r.left + r.width / 2 - 160)) + "px"; box.style.top = r.bottom + 8 + "px"; }
  const open = on => { box.hidden = !on; pill.setAttribute("aria-expanded", on); if (on) { draw(); place(); $("#plcity").focus(); } };
  pill.addEventListener("click", () => open(box.hidden));
  document.addEventListener("click", e => { const path = e.composedPath(); if (!box.hidden && !path.includes(box) && !path.includes(pill)) open(false); });   /* the path, not the target: draw() replaces the pill's inner nodes */
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !box.hidden) { open(false); pill.focus(); } });
  addEventListener("resize", () => !box.hidden && place());
  const busy = (on, msg) => { box.querySelectorAll("button").forEach(b => b.disabled = on); $("#plerr").textContent = msg || ""; };
  async function setCity() {
    const q = $("#plcity").value.trim(); if (!q) return;
    busy(true, "Looking for " + q + "…");
    try { await P().set(q); $("#plcity").value = ""; busy(false); open(false); } catch (_) { busy(false, "I couldn't find that place. Try the city name alone."); }
  }
  $("#plset").addEventListener("click", setCity);
  $("#plcity").addEventListener("keydown", e => { if (e.key === "Enter") setCity(); });
  $("#plgo").addEventListener("click", async () => {
    busy(true, "Finding your location…");
    try { const l = await P().detect(); busy(false, l ? "" : "Couldn't find you. Type a city instead."); if (l) open(false); } catch (_) { busy(false, "Couldn't find you. Type a city instead."); }
  });
  document.addEventListener("chandra:place", draw);
  draw();
})();
