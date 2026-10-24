"""Chandra Desktop: pack the editable UI into the host.

    python pack.py            build the page and embed it into chandra.py (and chandra_host.py, if present)
    python pack.py --check    build only; fail if the embedded page in chandra.py is out of date
    python pack.py --out FILE also write the built page to FILE (for inspection)

app.v1.html is the editable page. It may pull in modules with include markers:

    <!--@include ui/blob.js-->          a script, wrapped in <script data-src="ui/blob.js">
    <!--@include ui/chandra-ui.css-->  a stylesheet, wrapped in <style data-src="ui/chandra-ui.css">
    <!--@generate owl-->               the composer owl, decoded from assets/owl_opens_laptop_no_outline.ani

Standard library only, so it runs on the trimmed runtime Chandra Setup installs.
"""
import argparse, base64, gzip, io, json, re, struct, sys, zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
PAGE = HERE / "app.v1.html"
HOSTS = [HERE / "chandra.py", HERE / "chandra_host.py"]
ANI = HERE / "assets" / "owl_opens_laptop_no_outline.ani"
INCLUDE = re.compile(r"<!--@include ([\w./-]+)-->")
GENERATE = re.compile(r"<!--@generate (\w+)-->")
B64_BLOCK = re.compile(r'(APP_B64 = """\n)(.*?)(""")', re.S)


# ------------------------------------------------------------------ .ani (RIFF ACON) -> sprite sheet
def _png(width, height, rgba):
    """Encode RGBA bytes as a PNG (no Pillow needed)."""
    raw = b"".join(b"\x00" + rgba[y * width * 4:(y + 1) * width * 4] for y in range(height))
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def _cur_frame(blob):
    """One 'icon' chunk (a .cur/.ico file holding one 32-bit DIB) -> (w, h, RGBA bytes, top-down)."""
    _, _, count = struct.unpack("<3H", blob[:6])
    if count < 1:
        raise ValueError("empty icon frame")
    w, h, _, _, _, _, size, off = struct.unpack("<BBBBHHII", blob[6:22])
    w, h = w or 256, h or 256
    dib = blob[off:off + size]
    if dib[:8] == b"\x89PNG\r\n\x1a\n":
        raise ValueError("PNG-compressed cursor frames are not supported by pack.py")
    hdr, dw, dh2, _, bpp = struct.unpack("<IiiHH", dib[:16])
    if bpp != 32 or dw != w or dh2 != h * 2:
        raise ValueError("expected 32-bit %dx%d frames, got %d-bit %dx%d" % (w, h, bpp, dw, dh2 // 2))
    px = dib[hdr:hdr + w * h * 4]
    stride = ((w + 31) // 32) * 4                      # the 1-bit AND mask, padded to 32 bits
    mask = dib[hdr + w * h * 4:hdr + w * h * 4 + stride * h]
    has_alpha = any(px[i + 3] for i in range(0, len(px), 4))
    out = bytearray(w * h * 4)
    for y in range(h):
        src_row = h - 1 - y                            # DIBs are stored bottom-up
        for x in range(w):
            s = (src_row * w + x) * 4
            b, g, r, a = px[s], px[s + 1], px[s + 2], px[s + 3]
            if not has_alpha:
                a = 0 if (mask[src_row * stride + x // 8] >> (7 - x % 8)) & 1 else 255
            d = (y * w + x) * 4
            out[d:d + 4] = bytes((r, g, b, a))
    return w, h, bytes(out)


def owl_module():
    """Decode the supplied animated cursor into a sprite sheet and its own timeline (seq + rate)."""
    data = ANI.read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"ACON":
        raise ValueError("%s is not an animated cursor (RIFF/ACON)" % ANI.name)
    info, frames, meta = {}, [], {}

    def walk(pos, end):
        while pos + 8 <= end:
            cid, size = data[pos:pos + 4], struct.unpack("<I", data[pos + 4:pos + 8])[0]
            body = data[pos + 8:pos + 8 + size]
            if cid == b"LIST":
                walk(pos + 12, pos + 8 + size)
            elif cid == b"anih":
                k = "cb frames steps w h bits planes rate flags".split()
                info.update(zip(k, struct.unpack("<9I", body[:36])))
            elif cid == b"rate":
                info["rates"] = list(struct.unpack("<%dI" % (size // 4), body))
            elif cid == b"seq ":
                info["seq"] = list(struct.unpack("<%dI" % (size // 4), body))
            elif cid == b"icon":
                frames.append(body)
            elif cid in (b"INAM", b"IART"):
                meta[cid.decode().strip()] = body.split(b"\x00")[0].decode("latin-1")
            pos += 8 + size + (size & 1)
    walk(12, len(data))

    decoded = [_cur_frame(f) for f in frames]
    if not decoded:
        raise ValueError("no frames in %s" % ANI.name)
    w, h = decoded[0][0], decoded[0][1]
    n = len(decoded)
    sheet = bytearray(w * n * h * 4)
    top, bottom = h, 0
    for i, (_, _, rgba) in enumerate(decoded):
        for y in range(h):
            row = rgba[y * w * 4:(y + 1) * w * 4]
            sheet[(y * w * n + i * w) * 4:(y * w * n + i * w + w) * 4] = row
            if any(row[3::4]):
                top, bottom = min(top, y), max(bottom, y + 1)
    seq = info.get("seq") or list(range(n))
    rates = info.get("rates") or [info.get("rate", 4)] * len(seq)
    owl = {"src": "data:image/png;base64," + base64.b64encode(_png(w * n, h, bytes(sheet))).decode(),
           "w": w, "h": h, "frames": n, "seq": seq, "rate": rates, "crop": [top, bottom],
           "name": meta.get("INAM", ""), "artist": meta.get("IART", ""), "file": "assets/" + ANI.name}
    return "<script data-src=\"%s\">window.CHANDRA_OWL=%s;</script>" % (owl["file"], json.dumps(owl, separators=(",", ":")))


# ------------------------------------------------------------------ build
def _embed(rel):
    f = (HERE / rel).resolve()
    if HERE not in f.parents:
        raise ValueError("include outside desktop/source: " + rel)
    text = f.read_text(encoding="utf-8")
    if f.suffix == ".js":
        if re.search(r"</script", text, re.I):
            raise ValueError("%s contains '</script', which would end the page's script early" % rel)
        return '<script data-src="%s">\n%s\n</script>' % (rel, text)
    if f.suffix == ".css":
        if re.search(r"</style", text, re.I):
            raise ValueError("%s contains '</style'" % rel)
        return '<style data-src="%s">\n%s\n</style>' % (rel, text)
    raise ValueError("can only include .js or .css: " + rel)


def build():
    page = PAGE.read_text(encoding="utf-8")
    page = INCLUDE.sub(lambda m: _embed(m.group(1)), page)
    gens = {"owl": owl_module}
    page = GENERATE.sub(lambda m: gens[m.group(1)](), page)
    return page


def encode(page):
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9, mtime=0) as g:
        g.write(page.encode("utf-8"))
    b64 = base64.b64encode(buf.getvalue()).decode()
    return "\n".join(b64[i:i + 120] for i in range(0, len(b64), 120)) + "\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--out")
    ns = ap.parse_args()
    page = build()
    if ns.out:
        Path(ns.out).write_text(page, encoding="utf-8")
    block = encode(page)
    for host in HOSTS:
        if not host.exists():
            continue
        src = host.read_text(encoding="utf-8")
        m = B64_BLOCK.search(src)
        if not m:
            sys.exit("%s has no APP_B64 block" % host.name)
        current = gzip.decompress(base64.b64decode("".join(m.group(2).split()))).decode("utf-8")
        if ns.check:
            if current != page:
                sys.exit("%s is out of date: run python pack.py" % host.name)
            print("%s is up to date" % host.name)
            continue
        if current == page:
            print("%s already up to date" % host.name)
            continue
        host.write_text(src[:m.start(2)] + block + src[m.end(2):], encoding="utf-8")
        print("packed %s: page %.0f KB, embedded %.0f KB" % (host.name, len(page) / 1024, len(block) / 1024))


if __name__ == "__main__":
    main()
