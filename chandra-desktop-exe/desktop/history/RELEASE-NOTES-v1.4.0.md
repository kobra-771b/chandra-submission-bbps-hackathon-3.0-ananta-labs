# Chandra Desktop v1.4.0: the new home

## The new home, the voice bar, the buddy

- **A home that reads at a glance.** Three columns: "Continue where we left off" and "Quick actions" on the left; the greeting, the speaking light with four prompts around it, the voice bar and the replies in the centre, with the composer below; screen sense and "Today" on the right. The Chats list is now a compact panel that opens from the top bar, no longer a full-height bar.
- **Liquid glass.** The composer and the voice bar have a slow, viscous colour flowing inside the glass, in Chandra's palette, with a bright rim along the edge. It moves only while visible, holds still under Reduce motion, and falls back to a CSS version in Lite mode.
- **A new speaking and listening light.** Chandra's own shader (`ui/blob.js`), built from the parameter panel you supplied: the Aurora preset in the blues, a dark swirling body with a lobed core, a thin ribbon-textured rim and a soft halo. It turns on while Chandra speaks or listens and follows the voice; the earlier Strands port is gone.
- **A quieter home.** Hairline surfaces instead of heavy blur, quick actions as a plain list, the sky dimmer behind the content, and the four prompts around the light as plain text. The screen-sense "Intelligence" panel is hidden on Home for now.
- **The speaking light takes the moon's place while Chandra speaks.** The orb grows into the centre of the home stage, and the moon returns when speech ends.
- **Screen sense sees on its own.** In Chandra's window the screen is captured by Chandra's own process: there is no browser share prompt, and the frames never travel over HTTP. Chandra looks when something changes and turns off with the switch in the Screen sense card. In a plain browser it still needs one share, as before.
- **Typing and opening run without a question.** Typing, pasting, clicking, scrolling, opening apps and pages, clipboard and looking at the screen run on the permissions already granted in Settings. Deleting, moving or writing files, shell commands and other tool servers still ask first. "Stop all" stops everything.
- **Ctrl+Space** talks to Chandra (the same as the microphone).
- **A buddy.** A small pixel crab (13 × 9 pixels, scaled up) flies about the window. When Chandra is thinking or working it lands on a little laptop above the composer and types. Click it and it hops; get close and it zips away. Settings > Interface > Buddy turns it off.
- **The Claude key is no longer a field to paste.** Chandra uses the key in `chandra.env` in Chandra's data folder (or this computer's `ANTHROPIC_API_KEY`), and Settings says which. Nothing in the page, the source or the installer holds the key.
