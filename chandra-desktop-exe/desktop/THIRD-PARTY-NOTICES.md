# Third-party notices — Chandra Desktop

Chandra Desktop is © 2026 Ananta Labs. All rights reserved. The pieces below come from others and keep their own terms.

## React Bits — Target Cursor, Gradient ASCII and Grainient

`source/ui/target-cursor.js` (the target cursor), `source/ui/gradient-ascii.js` (the Starlight sky and the corona) and `source/ui/grainient.js` (placeholder art) are vanilla-JavaScript ports of the React Bits components **TargetCursor**, **GradientASCII** and **Grainient**. Chandra Setup (`installer/native/setup.cpp`) draws its sky with a CPU port of the Gradient ASCII field and glyph logic (https://reactbits.dev, https://github.com/DavidHDev/react-bits). The Gradient ASCII and Grainient shaders are used unchanged; the changes are listed at the top of each file. They are used here as part of an application, as the licence allows, and are not redistributed on their own.

```
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Chart colours

Chart artifacts use the categorical palette from a data-visualisation reference that is validated for colour-vision deficiencies; the eight values were re-checked against Chandra's `#0c0c0f` surface.

## KaTeX

`source/ui/katex.min.js` is KaTeX 0.19.0 (https://katex.org), unchanged, used to turn LaTeX in replies into MathML.

```
The MIT License (MIT)

Copyright (c) 2013-2020 Khan Academy and other contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## LZMA SDK

Chandra Setup decompresses its payload with `LzmaDec.c` from the LZMA SDK by Igor Pavlov, which is in the public domain (https://www.7-zip.org/sdk.html).

## SF Pro (Chandra Setup)

Chandra Setup embeds three static, Latin-only instances of the SF Pro font that Chandra's page already carries, so its window matches the app. SF Pro is Apple's typeface, and Apple's licence limits its use; before distributing Chandra Setup publicly, confirm you are entitled to, or swap the three files in `installer/native/assets/` for a font you can ship (Setup falls back to Segoe UI if they are missing).
