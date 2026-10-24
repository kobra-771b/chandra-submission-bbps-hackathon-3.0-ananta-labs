# Chandra Desktop v1.6.0: calm

## Screen sharing without the bridge

- **The window controls the computer itself.** In Chandra's own window, the screen, mouse, keyboard, screenshots and Screen sense go through the window's own channel instead of the HTTP computer bridge. There is nothing to connect: no bridge address, no pairing code, and Settings > Computer control just says it is built in. A plain browser keeps the loopback bridge as before.
- **Screen sense starts by itself, with no share prompt.** Chandra waits for its window to be ready and starts watching on its own. A slow start used to fall back to the browser's "pick a screen to share" dialog; that can no longer happen in the window. Each look happens inside Chandra's process: the screen is captured, compared with the last look as a tiny grey thumbnail, and only when it changed is one reduced frame sent to the vision model. No frame crosses HTTP or the page.
- **The brain goes through the window too.** Requests carrying screenshots never touch HTTP.
- **Nothing on the network can act while the window is open.** The HTTP `/act` route refuses computer actions then. Stop all still halts everything, and risky steps still ask first.

## A calmer Chandra

Shaped by current AI-native and calm-technology work: content first, controls that recede, depth from light rather than chrome, and one ambient presence instead of characters competing for attention.

- **The pets are gone.** The pixel crab buddy and the composer owl are removed, with their settings.
- **The aurora.** A new sky (`ui/aurora.js`) replaces the ASCII horizon: deep space, two slow aurora curtains in Chandra's blues and periwinkle, stars at two depths that drift a little with the pointer, the planet's dark arc with a thin rim of light, and fine grain so nothing bands. It follows Chandra: livelier while it thinks, cooler while it listens, warmer while it speaks (the rim follows the real voice). 30 fps at most, drawn at reduced resolution, paused when hidden; one still frame with Reduce motion, and a CSS version of the same scene in Lite mode or without WebGL. The ASCII corona stays around the moon.
- **One calm column on Home.** The greeting with Screen sense as one quiet line under it, the speaking light, the reply, the composer, and four quiet prompts under the composer. Gone from Home: the two side columns, the second voice bar and the prompts circling the moon. The composer's microphone, Hey Chandra and Ctrl+Space do the talking; recent chats are in the Chats panel and the day's log in Activity.
- **A shorter rail.** Daily moon, the Event Horizon button and the duplicate Focus button leave the rail; Event Horizon and Focus are in the profile menu.
- **Quieter surfaces.** Panels are solid enough to read over the light, with a hairline edge and a soft top highlight. The small speaking light beside the composer shows only while Chandra thinks or works; the big one takes the moon's place while it listens and speaks.

## Also

- **Sanjay** is the name Chandra uses until you give yours, or if you leave it blank. A name you typed is kept; 1.5's default (Anmol) becomes Sanjay.

Unchanged: the brain order (Claude, Gemini, the Chandra Engine), task approvals, the natural voice, artifacts, Playbooks, memory, MCP tools, diagnostics, Classic look.
