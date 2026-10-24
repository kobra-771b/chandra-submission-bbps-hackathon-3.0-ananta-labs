# Chandra 1.0.2: safeguards

A few small safeguards, always on, under every approval. They stay out of the way until they matter, and each one says plainly why it stopped so you can do the thing yourself.

- **No wiping commands.** Even with shell commands turned on, Chandra refuses commands that could wipe or damage the computer: deleting a whole drive or home folder (`rm -rf /`, `del /s /q C:\`, `Remove-Item -Recurse C:\`), formatting disks, deleting backups and shadow copies, editing boot settings, shutting down. Ordinary commands (`rm -rf build/`, `git status`) run as before.
- **No typing secrets.** Chandra won't type or copy anything that looks like a card number (checked with the card checksum), an API key, a token or a private key.
- **A brake on runaway clicking.** More than 45 clicks and keystrokes in one minute pauses the run; ask again to carry on.
- **No looking at private windows.** Screen sense doesn't look while a password manager, a bank or a private browsing window is in front, and says so; Chandra's screenshots refuse a password manager.

Settings > Diagnostics lists the safeguards; anything they stop is noted in the error log.
