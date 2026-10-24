# Chandra Link

Phone and PC talk to each other over your Wi-Fi. No account, no cloud.

## Use it
1. Double-click `start.bat` on the PC (first run sets itself up).
2. Click **Allow** if Windows Firewall asks (tick *Private networks*).
3. On your phone (same Wi-Fi), scan the QR code on the PC page with the camera. That pairs it, no PIN typing.
4. In Chrome: menu, **Add to Home screen**, so it opens like an app.
5. Optional: double-click `autostart-on.bat` so the PC side starts when you log in.

## Android app (optional, better)
The Android app keeps the link alive in the background and shows real notifications even when the page is closed. Install `Chandra-Link.apk`, open it, tap **Find my PC**, tap **Connect**, type the PIN once. Allow notifications, and say yes when it asks to stop battery saving for the app.

## What works
- **Ask Chandra from your phone:** type an instruction on the phone page. Link opens Chandra on the PC (if needed), types it in, and sends Chandra's answer back to your phone. Chandra's own approval prompts still apply on the PC.
- **Open Chandra on your phone** from the PC page.
- Phone to PC: ping, open Chandra, lock, sleep, shut down (the PC asks you first), open a link, copy text to the clipboard, show a PC notification.
- PC to phone: notification and "ring my phone" (sound and vibration, while the phone page is open).
- Each side shows if the other is online. Pairing survives restarts.

## Limits
- In a browser, alerts only come while the page is open. The Android app fixes that (no Google needed).
- Traffic on your Wi-Fi is plain HTTP. Pair at home, not on shared Wi-Fi.
- The PC is kept from sleeping while Link runs (`--no-keep-awake` turns that off), since Wi-Fi PCs can't be woken remotely.
- If your router gives the PC a new IP, scan the QR again (or reserve the IP in the router).

Test mode (non-Windows) records actions without running them. Set `CHANDRA_LINK_DRYRUN=1` on Windows to try it safely.

## If "Ask Chandra" says it can't
- Close Chandra completely, then tap **Open Chandra** on the phone page (or just ask again). Link has to be the one that opens Chandra.
- If it says it can't find the message box or send button, tell me; I only need a screenshot of Chandra's chat window.
