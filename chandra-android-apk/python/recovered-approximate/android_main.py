# Source Generated with Decompyle++
# File: android_main.pyc (Python 3.12)

"""Chandra for Android: runs the desktop host (chandra.py, unchanged) inside the app.

MainActivity calls start(); the host serves the same page and the same routes as the desktop app's
browser mode (/brain, /tts, /stt, /image, /artifacts, /memory/search, /act for web tools ...) on
127.0.0.1 only, behind the pairing code. Only the pieces that need a PC are swapped for Android ones:
the clipboard and opening links use Android; mouse, keyboard and screen control say they need a computer.
"""
import os
import threading
from pathlib import Path
PHONE_ONLY = "That needs Chandra on a computer: a phone can't be driven by mouse, keyboard or screen control."
_STATE = { }

def _android():
    jclass = jclass
    import java
    return jclass('labs.ananta.chandra.MainActivity')


def _clip_get():
    if not _android().clipGet():
        _android().clipGet()
    return str('')


def _clip_set(text):
    _android().clipSet(str(text))


def _open_url(a):
    u = str(a['url'])
    if not u.lower().startswith(('http://', 'https://')):
        raise RuntimeError('Only http(s) URLs')
    _android().openExternal(u)
    return {
        'ok': True }


def _open_app(a):
    n = str(a.get('name', '')).strip()
    if not n:
        raise RuntimeError('Invalid app name')
    if not _android().openApp(n):
        raise RuntimeError("I couldn't find an app called " + n + ' on this phone.')
    return {
        'ok': True }


def _no_pc(*_a, **_k):
    raise RuntimeError(PHONE_ONLY)


def start(data_dir, assets_dir):
    '''Start the host once; returns the app URL for the WebView.'''
    pass
# WARNING: Decompyle incomplete

