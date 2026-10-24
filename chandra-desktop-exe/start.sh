#!/bin/bash
# Chandra by Ananta Labs: memory, voice, face, engine, desktop, hands.
# Copyright (C) 2026 Ananta Labs. All rights reserved.

# Starts Chandra's pieces, in the right order:
#   ai-visualizer   (the face, opens in your browser on the Chandra face)
#   barehands       (the hands, URL printed; open it when you want the board)
#   Chandra Engine  (re-indexes the vault in the background)
#   backtalk        (the voice, runs in this terminal; Ctrl-C stops EVERYTHING)
# Pieces you didn't install are skipped automatically.
#
#   ./start.sh          everything installed (except the desktop window)
#   ./start.sh voice    the voice and the face (no hands)
#   ./start.sh hands    the voice and the hands board (no face)
#   ./start.sh desktop  Chandra Desktop, with the engine's server behind it
#   ./start.sh local    typed chat with the LOCAL model only (works offline)

HERE="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$(dirname "$HERE")"
MODE="${1:-all}"
PIDS=()

cleanup() {
  trap - EXIT INT TERM
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done
  echo
  echo "Chandra is at rest."
}
trap cleanup EXIT INT TERM

# The engine's Python, as setup recorded it in engine/engine.json, falling
# back to where OpenJarvis's installer puts it by default.
ENGINE_JSON="$HERE/engine/engine.json"
ENGINE_PY="$(sed -n 's/.*"python"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ENGINE_JSON" 2>/dev/null | head -n 1)"
[ -x "$ENGINE_PY" ] || ENGINE_PY="${OPENJARVIS_HOME:-$HOME/.openjarvis}/.venv/bin/python"
[ -x "$ENGINE_PY" ] && [ -f "$ENGINE_JSON" ] || ENGINE_PY=""
ENGINE_URL="${CHANDRA_ENGINE_URL:-http://127.0.0.1:8000}"
ENGINE_PORT="${ENGINE_URL##*:}"; ENGINE_PORT="${ENGINE_PORT%%/*}"

# Keeps the engine current: re-applies Chandra's persona if something reset
# it, and re-indexes the vault so local search sees today's notes.
engine_sync() {
  "$ENGINE_PY" -I "$HERE/engine/chandra_engine.py" --sync >"$HERE/engine/sync.log" 2>&1 &
  PIDS+=($!)
}

if [ "$MODE" = "local" ]; then
  trap - EXIT INT TERM
  if [ -z "$ENGINE_PY" ]; then
    echo "The Chandra Engine isn't installed or wired yet."
    echo "Open a chat with Chandra and say: add the engine."
    exit 1
  fi
  echo "Chandra, offline: the local model on this computer. /quit to leave."
  "$ENGINE_PY" -I "$HERE/engine/chandra_engine.py" --sync >"$HERE/engine/sync.log" 2>&1 &
  exec "$ENGINE_PY" -I -m openjarvis.cli
fi

if [ "$MODE" = "desktop" ]; then
  DESKTOP_PY="$HERE/desktop/.venv/bin/python"
  if [ ! -x "$DESKTOP_PY" ]; then
    trap - EXIT INT TERM
    echo "Chandra Desktop isn't installed yet."
    echo "Open a chat with Chandra and say: add Chandra Desktop."
    exit 1
  fi
  echo "Chandra Desktop: starting from $HOME_DIR"
  if [ -n "$ENGINE_PY" ]; then
    engine_sync
    if curl -s -m 2 "$ENGINE_URL/v1/models" >/dev/null 2>&1; then
      echo "  engine:  already serving at $ENGINE_URL"
    else
      "$ENGINE_PY" -I -m openjarvis.cli serve --port "$ENGINE_PORT" >"$HERE/engine/serve.log" 2>&1 &
      PIDS+=($!)
      echo "  engine:  serving at $ENGINE_URL (log in engine/serve.log)"
    fi
  else
    echo "  engine:  not installed; Chandra Desktop will need a Claude key in chandra.env"
  fi
  WINDOW=()
  [ "$(uname -s)" = "Linux" ] && WINDOW=(--browser)
  echo "  desktop: opening the Chandra window. Close it, or Ctrl-C here, to stop."
  "$DESKTOP_PY" "$HERE/desktop/source/chandra.py" "${WINDOW[@]}"
  exit 0
fi

echo "Chandra: starting from $HOME_DIR"

if [ -d "$HOME_DIR/ai-visualizer" ] && [ "$MODE" != "hands" ]; then
  (cd "$HOME_DIR/ai-visualizer" && exec python3 server.py) &
  PIDS+=($!)
  echo "  face:   starting (your browser opens on the Chandra face)"
fi

if [ -d "$HOME_DIR/barehands" ] && [ "$MODE" != "voice" ]; then
  (cd "$HOME_DIR/barehands" && exec python3 server.py) &
  PIDS+=($!)
  echo "  hands:  starting (open the printed URL in Chrome when you want the board)"
fi

if [ -n "$ENGINE_PY" ]; then
  engine_sync
  echo "  engine: syncing (persona + vault index, in the background; log in engine/sync.log)"
fi

if [ -d "$HOME_DIR/backtalk" ]; then
  echo "  voice:  starting (hold your talk key and speak; Ctrl-C here stops everything)"
  cd "$HOME_DIR/backtalk" && ./run.sh
else
  echo
  echo "No voice installed; servers are up. Ctrl-C stops everything."
  wait
fi
