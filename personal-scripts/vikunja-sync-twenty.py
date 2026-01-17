#!/usr/bin/env python3
"""Run Vikunja sync and suppress no-op output."""

from __future__ import annotations

import os
import re
import subprocess
import sys


def main() -> int:
    env = os.environ.copy()
    env["RICH_DISABLE"] = "1"
    env["NO_COLOR"] = "1"
    env["TERM"] = "dumb"

    result = subprocess.run(
        ["uv", "run", "skills/vikunja/scripts/vikunja.py", "sync-twenty"],
        cwd="/Users/steve/clawd",
        env=env,
        text=True,
        capture_output=True,
    )

    output = (result.stdout or "") + (result.stderr or "")

    if result.returncode != 0:
        sys.stderr.write(output.strip() + "\n")
        return result.returncode

    clean = re.sub(r"\x1B\[[0-9;]*[A-Za-z]", "", output)
    stripped = clean.strip()

    if not stripped:
        return 0

    if "No engagements found in Twenty CRM." in stripped:
        return 0

    matches = re.findall(r"Created (\d+) new projects", stripped)
    if matches and int(matches[-1]) == 0:
        return 0

    sys.stdout.write(stripped + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
