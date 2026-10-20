# AGENTS.md

This repository is a multi-branch dental clinic system with a defense on Saturday 2026-10-24; it must be hosted (Vercel + Railway + Supabase) and working before Thursday 2026-10-22 (HANDOFF.md section 0.1).

Before doing anything, read HANDOFF.md in the repository root, fully, and follow its section 0 ("READ THIS FIRST").

Non-negotiable rules (full list in HANDOFF.md section 2):
- Never touch the dental_clinic database; work on dental_clinic_demo and dental_clinic_test only. Changes the real clinic database needs are listed as pending in docs/POST_DEFENSE_TASKS.md.
- Never print, log or commit secrets (backend/.env). Scan every diff for secrets.
- No git push and no merge unless the user asks.
- Do not invent clinic facts; use Owner-editable settings with defaults labelled "not confirmed by the clinic".
- Keep module statuses honest (Implemented / Partial / Mock only / Planned).
- No hard deletes of data; respect append-only tables. Delete code or files only through git after the user approves the cleanup list.
- Use Asia/Manila for time.
- Work in this order: host first (HANDOFF.md section 0.1, deadline before Thursday 2026-10-22), finishing the in-progress work in the gaps; then improve; clean up only if 100% safe.
- Reports to the user are short, ordered and honest. Always finish a task with: full test suites, smoke, build, scripts/predefense-check.sh, then commit in logical commits.
