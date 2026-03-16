#!/usr/bin/env python3
import argparse
import subprocess
import sys
from pathlib import Path


def run(cmd, check=True, capture=False):
    return subprocess.run(
        cmd,
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
    )


def git_output(args):
    res = run(["git", *args], capture=True)
    return (res.stdout or "").strip()


def current_branch():
    return git_output(["rev-parse", "--abbrev-ref", "HEAD"]) or "main"


def changed_files():
    text = git_output(["status", "--porcelain"])
    files = []
    for line in text.splitlines():
        if not line:
            continue
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        files.append(path)
    return files


def group_by_top_level(paths):
    groups = {}
    for p in paths:
        top = Path(p).parts[0] if Path(p).parts else p
        groups.setdefault(top, []).append(p)
    ordered = []
    for key in sorted(groups.keys()):
        ordered.extend(sorted(groups[key]))
    return ordered


def chunk(items, size):
    return [items[i:i + size] for i in range(0, len(items), size)]


def staged_has_changes():
    res = subprocess.run(["git", "diff", "--cached", "--quiet"])
    return res.returncode != 0


def batch_summary(files, max_items=3):
    shown = ", ".join(files[:max_items])
    if len(files) > max_items:
        shown += f" +{len(files) - max_items} more"
    return shown


def main():
    parser = argparse.ArgumentParser(description="Fast multi-commit multi-push helper")
    parser.add_argument("--remote", default="origin")
    parser.add_argument("--branch", default="", help="Defaults to current branch")
    parser.add_argument("--batch-size", type=int, default=25)
    parser.add_argument("--prefix", default="chore: batch")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("paths", nargs="*", help="Optional file paths. Defaults to all changed files.")
    args = parser.parse_args()

    try:
        run(["git", "rev-parse", "--is-inside-work-tree"], capture=True)
    except subprocess.CalledProcessError:
        print("Not inside a git repository.")
        return 1

    branch = args.branch or current_branch()
    files = args.paths if args.paths else changed_files()
    files = [f for f in files if f and f != ".env"]

    if not files:
        print("No changed files to commit.")
        return 0

    ordered = group_by_top_level(files)
    batches = chunk(ordered, max(1, args.batch_size))

    print(f"Preparing {len(batches)} commits on branch '{branch}' to remote '{args.remote}'.")

    for i, batch in enumerate(batches, start=1):
        msg = f"{args.prefix} {i}/{len(batches)}"
        summary = batch_summary(batch)

        if args.dry_run:
            print(f"[dry-run] {msg}: {summary}")
            continue

        run(["git", "add", "-A", "--", *batch])
        if not staged_has_changes():
            print(f"Skip {msg}: nothing staged")
            continue

        run(["git", "commit", "-m", f"{msg}: {summary}"])
        run(["git", "push", args.remote, branch])
        print(f"Pushed {msg}")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
