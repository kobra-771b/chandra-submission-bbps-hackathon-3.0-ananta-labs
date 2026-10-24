#!/bin/bash
# Chandra by Ananta Labs: memory, voice, face, engine, desktop, hands.
# Copyright (C) 2026 Ananta Labs. All rights reserved.

# Pulls the newest version of every installed piece, and of the Chandra
# Engine (OpenJarvis). This toolbox itself (Chandra's own build: the setup,
# the face, the engine bridge, Chandra Desktop) is never pulled from any
# upstream repo: a reset would erase Chandra.
# Your own files (your CLAUDE.md, your vault, your configs) live outside
# the repos' tracked files, so updates never touch them. If git reports
# a conflict on a config you edited, your edit wins; keep your version.

HERE="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$(dirname "$HERE")"

# Everything runs from main() so the whole script is parsed before any of
# it executes; updating this very file mid-run can then never garble it.
main() {
  for repo in ai-memory-vault backtalk barehands ai-visualizer; do
    CFG=""
    case "$repo" in
      backtalk) CFG="backtalk.json" ;;
      barehands) CFG="barehands.json" ;;
      ai-visualizer) CFG="ai-visualizer.json" ;;
    esac
    [ -d "$HOME_DIR/$repo" ] || continue
    if [ ! -d "$HOME_DIR/$repo/.git" ]; then
      echo "== $repo (wiring to updates)"
      [ -n "$CFG" ] && [ -f "$HOME_DIR/$repo/$CFG" ] && cp "$HOME_DIR/$repo/$CFG" "$HOME_DIR/$repo/$CFG.mine"
      git -C "$HOME_DIR/$repo" init -q -b main
      URL="$(sed -n "s/^$repo=//p" "$HERE/sources.conf" 2>/dev/null | head -n 1)"
      [ -n "$URL" ] || { echo "   no address for $repo in sources.conf; skipped."; continue; }
      git -C "$HOME_DIR/$repo" remote add origin "$URL"
      git -C "$HOME_DIR/$repo" fetch -q origin
      git -C "$HOME_DIR/$repo" reset -q --hard origin/main
      git -C "$HOME_DIR/$repo" branch -q --set-upstream-to=origin/main main
      [ -n "$CFG" ] && [ -f "$HOME_DIR/$repo/$CFG.mine" ] && mv "$HOME_DIR/$repo/$CFG.mine" "$HOME_DIR/$repo/$CFG"
      echo "   wired to updates. everything is current."
      continue
    fi
    echo "== $repo"
    git -C "$HOME_DIR/$repo" fetch -q origin 2>/dev/null
    git -C "$HOME_DIR/$repo" log --oneline "..@{u}" 2>/dev/null | sed "s/^/   new: /"
    MIGRATE=0
    if [ -n "$CFG" ] && [ -f "$HOME_DIR/$repo/$CFG" ] && \
       git -C "$HOME_DIR/$repo" ls-files --error-unmatch "$CFG" >/dev/null 2>&1; then
      cp "$HOME_DIR/$repo/$CFG" "$HOME_DIR/$repo/$CFG.mine" && \
        git -C "$HOME_DIR/$repo" checkout -q -- "$CFG" && MIGRATE=1
    fi
    git -C "$HOME_DIR/$repo" pull --ff-only || \
      echo "   (couldn't fast-forward; your local edits win. See the note at the top of this script.)"
    if [ "$MIGRATE" = 1 ] && [ -f "$HOME_DIR/$repo/$CFG.mine" ]; then
      mv "$HOME_DIR/$repo/$CFG.mine" "$HOME_DIR/$repo/$CFG"
    fi
  done
  ENGINE_PY="$(sed -n 's/.*"python"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$HERE/engine/engine.json" 2>/dev/null | head -n 1)"
  [ -x "$ENGINE_PY" ] || ENGINE_PY="${OPENJARVIS_HOME:-$HOME/.openjarvis}/.venv/bin/python"
  if [ -x "$ENGINE_PY" ]; then
    echo "== the Chandra Engine (OpenJarvis)"
    "$ENGINE_PY" -I -m openjarvis.cli self-update --yes || \
      echo "   (the engine couldn't update; ask Chandra to run 'jarvis doctor')"
  fi
  # The face Chandra wears lives in this toolbox; refresh the copy the visualizer serves.
  if [ -d "$HOME_DIR/ai-visualizer/faces" ]; then
    mkdir -p "$HOME_DIR/ai-visualizer/faces/chandra" && cp -f "$HERE/face/chandra/"* "$HOME_DIR/ai-visualizer/faces/chandra/"
  fi
  echo "update complete."
  if ! ls "$HOME/Desktop/Update "*.command >/dev/null 2>&1; then
    echo "Tip: want a desktop Update icon that does this on a double-click? Ask Chandra for one."
  fi
}
main "$@"
