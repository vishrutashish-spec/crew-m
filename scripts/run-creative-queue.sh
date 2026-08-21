#!/bin/bash
set -euo pipefail

cd "$HOME/insurwreck"

LOG_DIR="$HOME/insurwreck/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/creative-queue-$(date +%Y%m%d-%H%M%S).log"

PROMPT="$(cat "$HOME/insurwreck/scripts/process-creative-queue.md")"

/opt/homebrew/bin/claude -p "$PROMPT" \
  --output-format text \
  --permission-mode bypassPermissions \
  --max-budget-usd 1 \
  > "$LOG_FILE" 2>&1

echo "$(date '+%Y-%m-%d %H:%M:%S') exit=$? log=$LOG_FILE" >> "$LOG_DIR/run-history.log"
