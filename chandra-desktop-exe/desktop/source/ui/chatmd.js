/* Markdown and LaTeX in Chandra's replies. The reply card and the chat thread call ChandraMD.set(element, text):
   plain sentences stay plain text; anything with Markdown or a formula is drawn by ChandraRender.markdown (DOM only,
   no innerHTML) with KaTeX maths as MathML. The source text is kept in data-src so the thread can store it. */
(() => {
  const R = window.ChandraRender;
  const LOOKS = /[*`#>|]|\$[^$\n]+\$|\\[(\[]|^\s*(?:[-+]|\d+[.)])\s|\n|~~/m;
  function set(el, text) {
    text = String(text == null ? "" : text);
    el.dataset.src = text;
    if (!R || !LOOKS.test(text)) { el.textContent = text; return el; }
    el.textContent = "";
    const doc = R.markdown(text); doc.classList.add("chat-md");
    el.append(doc);
    return el;
  }
  window.ChandraMD = { set };
})();
