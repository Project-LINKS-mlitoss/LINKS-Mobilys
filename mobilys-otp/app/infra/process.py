# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import subprocess
from typing import Iterable, List, Tuple


def run_command(cmd: List[str], *, capture_output: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        capture_output=capture_output,
        text=True,
        check=False,
    )


def run_streaming(cmd: List[str]) -> Tuple[int, List[str]]:
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    lines: List[str] = []
    if process.stdout:
        for line in process.stdout:
            line = line.strip()
            lines.append(line)
            print(line)

    process.wait()
    return process.returncode, lines