#!/usr/bin/env python3
"""Build the static site and its downloadable-file catalog."""

import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist"
STORAGE = ROOT / "storage"


def is_hidden(path: Path) -> bool:
    return any(part.startswith(".") for part in path.relative_to(STORAGE).parts)


def build_catalog():
    entries = []
    if STORAGE.exists():
        for path in STORAGE.rglob("*"):
            if path.is_symlink() or not path.is_file() or is_hidden(path):
                continue
            entries.append({
                "path": path.relative_to(ROOT).as_posix(),
                "size": path.stat().st_size,
            })
    entries.sort(key=lambda entry: entry["path"].casefold())
    return {
        "repository": os.environ.get("GITHUB_REPOSITORY", ""),
        "branch": os.environ.get("GITHUB_REF_NAME", "main"),
        "files": entries,
    }


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name in ("index.html", "styles.css", "app.js"):
        shutil.copy2(ROOT / name, OUTPUT / name)
    if STORAGE.exists():
        shutil.copytree(
            STORAGE,
            OUTPUT / "storage",
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns(".*"),
        )
    (OUTPUT / "catalog.json").write_text(
        json.dumps(build_catalog(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
