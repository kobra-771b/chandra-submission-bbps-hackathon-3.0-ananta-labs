/* Options: a Paste button beside every API-key box, and Ctrl+V in them, both reading the clipboard through Chandra's host,
   because a window can block its own paste. Also Options > Privacy: clear all history. */
(() => {
  const H = { authorization: "Bearer __CHANDRA_PAIR__" };
  const prefs = document.getElementById("prefs");
  if (!prefs) return;
  const isKey = el => el && el.tagName === "INPUT" && (el.type === "password" || /\bkey\b|api|secret|sk-ant|AIza/i.test((el.placeholder || "") + (el.getAttribute("aria-label") || "")));
  async function clip() {
    try { const r = await fetch(location.origin + "/clipboard/text", { headers: H }); const d = await r.json(); if (d.text) return d.text; } catch (_) {}
    try { return await navigator.clipboard.readText(); } catch (_) { return ""; }
  }
  async function paste(el) {
    const t = String(await clip()).trim();
    if (!t) { try { window.toast && toast("Nothing to paste", "Copy the key first, then try again"); } catch (_) {} return; }
    el.value = t; el.dispatchEvent(new Event("input", { bubbles: true })); el.focus();
    try { window.toast && toast("Pasted", "Now press Save"); } catch (_) {}
  }
  function decorate() {
    prefs.querySelectorAll("input").forEach(el => {
      if (!isKey(el) || el.dataset.pasteReady || !el.closest(".jr")) return;
      el.dataset.pasteReady = "1";
      const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = "Paste"; b.dataset.paste = "1";
      b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); paste(el); });
      el.after(b);
    });
  }
  prefs.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "v" || e.key === "V") && isKey(e.target)) { e.preventDefault(); paste(e.target); }
  }, true);
  new MutationObserver(decorate).observe(prefs, { childList: true, subtree: true });
  decorate();

  /* Options > Privacy */
  const box = document.createElement("div"); box.id = "privacy";
  box.innerHTML = '<div class="grp">Privacy</div><div class="list g"><div class="row"><span class="f">Clear all history<br><span class="mu sm">Removes chats, recents, activity, the daily moon, the night sky and the error and start logs. Your name, look, keys and settings stay.</span></span><button class="btn" id="clrHist">Clear</button></div></div>';
  prefs.append(box);
  box.querySelector("#clrHist").addEventListener("click", async () => {
    if (!confirm("Clear all history? Chats, recents and activity will be removed. Your keys and settings stay.")) return;
    ["chandra-threads", "chandra-hist", "chandra-moon", "chandra-sky", "chandra-task", "chandra-night"].forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
    try { await fetch(location.origin + "/log/clear", { method: "POST", headers: { ...H, "content-type": "application/json" }, body: "{}" }); } catch (_) {}
    try { window.toast && toast("History cleared"); } catch (_) {}
    setTimeout(() => location.reload(), 600);
  });
})();
