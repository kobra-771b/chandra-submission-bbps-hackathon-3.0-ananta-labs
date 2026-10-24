# Chandra 1.0.6: Markdown and LaTeX

- **Markdown in replies.** Headings, lists, **bold**, `code`, code blocks, tables, quotes and links are drawn properly in the reply card and in the chat thread, instead of showing the symbols. Plain sentences stay plain. Chandra is told it may use light Markdown for typed requests; spoken answers stay plain.
- **LaTeX maths.** `$x^2+1$` inline, `$$ ... $$` or `\[ ... \]` for display formulas, and `\( ... \)`: fractions, roots, sums, integrals, matrices and the rest of KaTeX. Maths is drawn as MathML with the computer's own math font, so it adds no fonts. Prices like "$5 and $10" are not mistaken for maths, and a formula that cannot be read stays visible as its source.
- **Chat keeps its formatting.** The thread now stores line breaks and up to 4000 characters of a reply (it was one line, cut at 400).
- **Voice.** Formulas are never read aloud symbol by symbol; Chandra says "the formula on screen".
- Document artifacts get the same maths. KaTeX 0.19.0 is bundled (about 100 KB more to download).
