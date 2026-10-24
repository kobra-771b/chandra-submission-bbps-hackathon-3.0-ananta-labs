# Chandra Desktop v1.7.0: voice first

Talking is now the main way to use Chandra; typing is there when you want it.

## Talk to it

- **The moon is the talk button.** Tap it to start a conversation (tap again to stop), or hold it to talk. Hold **Space** anywhere outside a text field to talk; **Ctrl+Space** still toggles a conversation. Soft chimes mark listening on and off.
- **Conversations keep going.** After Chandra answers it listens again, hands-free, until you say you're done ("that's all", "bas", "धन्यवाद") or go quiet for a while. Just start talking to interrupt it.
- **Captions carry the conversation.** What you said appears small; what Chandra says appears large, and the sentence being spoken lights up as it goes. Approvals still use the full card, and approving is still a tap.
- **The home tells you what to do.** The line under the greeting follows the conversation (Tap the moon or hold Space to talk, Listening, Got it, Thinking, Speaking · just talk to interrupt), a ring around the moon follows your voice, and the prompts under the composer are things to say. The composer is quieter and narrower; start typing anywhere and it takes the keys.

## Chandra listens for itself

- **Gemini listening.** With a Gemini key, Chandra records the microphone itself (echo cancellation and noise suppression on), finds where you start and stop speaking, and has Gemini write down what you said. This works in Chandra's window, where the browser's own speech recognition is unreliable, and it follows **English, Hindi and Hinglish**, even in one sentence. In the window the recording goes through the window itself, never over HTTP; nothing is stored.
- **Interrupting works.** While Chandra speaks in the natural voice, sustained speech interrupts it and becomes your next request; its own voice does not, thanks to echo cancellation. With the computer's voice, which plays outside the page, listening rests while it speaks: tap the moon to interrupt.
- **Fallbacks.** Without a Gemini key, or if Gemini fails (quota, offline), Chandra uses the browser's recogniser and says so. The "Hey Chandra" wake word still uses the browser's recogniser. Settings > Chandra voice > Listening switches between the two.

## More natural speech

- **Speech, not text read aloud.** Markdown, code, links and emoji are no longer read out ("the link on screen", "I've put the code on screen"); "e.g." becomes "for example".
- **Spoken requests get spoken answers.** When you talk, Chandra answers like a person talking: one to three short sentences, no lists or headings, and it offers more instead of reading it all.
- **Accent and pacing.** The natural voice now gets a direction per language: natural conversational Hindi for Hindi, and a gentle Indian English accent for English and Hinglish (Settings > Accent: Indian, Neutral, British, American). The computer's voice speaks sentence by sentence with a short breath between, which also avoids browsers cutting long speech off.

## Hindi

- **English, हिन्दी or Hinglish** from a switch beside the Screen sense line (and in Settings). Chandra answers in the language you used: Hindi in Devanagari, Hinglish in English letters, otherwise English.
- **Hindi voices.** Hindi text is always spoken by a Hindi voice: Gemini's voices speak Hindi, and on the computer Chandra picks the best Hindi voice installed (Microsoft Swara or Madhur natural voices, Kalpana, Google हिन्दी).
- **Hindi words for stopping:** "bas", "ruko", "shukriya", "बस", "रुको", "धन्यवाद", "ठीक है बस" end a conversation, and Chandra's short replies ("और कुछ?") follow your language. The wake word already knew चंद्र.

Diagnostics now report how Chandra is listening. Unchanged: the brain order, task approvals, the native window bridge, artifacts, Playbooks, the aurora and the calm home.
