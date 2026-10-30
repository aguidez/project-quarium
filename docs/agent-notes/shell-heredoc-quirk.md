---
name: shell-heredoc-quirk
description: "(Windows, Git Bash under Claude Code) A Bash heredoc whose body contains an apostrophe fails (\"unexpected EOF\"); write scripts with the Write tool instead"
metadata:
  type: reference
  modified: 2026-10-30T11:24:05.302Z
---

A `node - <<'EOF' ... EOF` (or `cat > f <<'X'`) command fails with "unexpected EOF while looking for matching `''" as soon as the heredoc body contains an apostrophe (e.g. "the tab's", "don't" in TS comments), even with a quoted delimiter. Heredocs without apostrophes work.

**How to apply:** for multi-line code edits by script, write the script file to the scratchpad with the Write tool, then run `node script.js <target>`. In such transform scripts, check each pattern exists (throw if not) and mind tab depth (TSX here is tab-indented).
