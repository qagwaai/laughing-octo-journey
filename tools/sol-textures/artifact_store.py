"""External Sol originals and evidence: explicit roots, verified copies, no deletions."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil

REPOSITORY = Path(__file__).resolve().parents[2]
DEFAULT_ENV = "SOL_TEXTURE_ARTIFACT_ROOT"
SCHEMA = "sol-texture-artifact-store-v1"


def artifact_root(value=None):
    configured = value or os.environ.get(DEFAULT_ENV)
    if not configured:
        raise ValueError(f"Specify --artifact-root or {DEFAULT_ENV}; no machine-specific default")
    root = Path(configured).resolve()
    if root == Path(root.anchor) or root.is_relative_to(REPOSITORY) or REPOSITORY.is_relative_to(root):
        raise ValueError("Artifact root must be a dedicated directory outside the repository, not its ancestor")
    return root


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def inventory_path(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or path == root:
        raise ValueError(f"Inventory path escapes artifact store: {relative}")
    return path


def verify_store(root):
    inventory = json.loads((root / "artifact-inventory.json").read_text(encoding="utf-8"))
    if inventory.get("schema") != SCHEMA:
        raise ValueError("Unsupported artifact inventory")
    seen = set()
    for entry in inventory["files"]:
        relative = entry["path"]
        if relative in seen:
            raise ValueError(f"Duplicate inventory entry: {relative}")
        seen.add(relative)
        path = inventory_path(root, relative)
        if path.stat().st_size != entry["bytes"] or sha256(path) != entry["sha256"]:
            raise ValueError(f"Artifact integrity mismatch: {relative}")
    print(f"PASS: {len(seen)} archived files verified in {root}")
    return inventory


def archive_session(session_files, root):
    if root.exists():
        raise FileExistsError(f"Refusing to overwrite artifact store: {root}")
    if root.is_relative_to(session_files) or session_files.is_relative_to(root):
        raise ValueError("Session and artifact roots must be separate")
    copies = []
    for body in ["earth", "luna", "mars"]:
        audit = session_files / (body + "-source-audit")
        manifest = json.loads((audit / "acquisition-manifest.json").read_text())
        for entry in manifest["files"]:
            original = audit / "sources" / entry["file"]
            if original.stat().st_size != entry["bytes"] or sha256(original) != entry["sha256"]:
                raise ValueError(f"Audited original mismatch: {original}")
        for original in sorted((audit / "sources").iterdir()):
            if original.is_file():
                copies.append((original, Path("sources") / body / original.name))
        for original in sorted(audit.iterdir()):
            if original.is_file():
                copies.append((original, Path("evidence") / "2026-10-08" / body / original.name))
    # Preserve selected diagnostic evidence, not incomplete/superseded screenshot runs.
    for folder in ["landmarks-v2", "renderer-evidence-v3"]:
        source = session_files / "sol-texture-diagnostics" / folder
        if not source.is_dir():
            raise FileNotFoundError(source)
        for original in sorted(source.iterdir()):
            if not original.is_file():
                raise ValueError(f"Unexpected nested evidence: {original}")
            copies.append((original, Path("evidence") / "2026-10-08" / "diagnostics" / folder / original.name))
    earth_final = session_files / "earth-source-audit" / "derivatives" / "earth-july-v2"
    for name in ["derivative-manifest.json", "offline-validation.json"]:
        copies.append((earth_final / name, Path("evidence") / "2026-10-08" / "earth" / name))
    # Numerical reference is an additional audited original outside the acquisition manifest.
    lunar = session_files / "luna-source-audit" / "sources" / "LDEM_16.IMG"
    if sha256(lunar) != "a511e40d7a3ea3275945b4da2a1df377133264fab0be94b7434b1cf8907254cb":
        raise ValueError("Original signed LOLA reference mismatch")
    inventory = {"schema": SCHEMA, "createdAt": datetime.now(timezone.utc).isoformat(),
                 "scope": "October 2026 Sol source originals/notices, historical scripts and selected validation evidence",
                 "excluded": ["Python venv/bytecode", "superseded/failed derivatives", "duplicate diagnostic runs",
                              "Forge contract artifacts and unrelated artifact types"],
                 "files": []}
    root.mkdir(parents=True)
    for original, relative in copies:
        target = inventory_path(root, relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            raise FileExistsError(target)
        expected_hash = sha256(original)
        expected_bytes = original.stat().st_size
        shutil.copyfile(original, target)
        if target.stat().st_size != expected_bytes or sha256(target) != expected_hash:
            raise ValueError(f"Copy verification failed: {target}")
        inventory["files"].append({"path": relative.as_posix(), "bytes": expected_bytes, "sha256": expected_hash})
    (root / "artifact-inventory.json").write_text(json.dumps(inventory, indent=2), encoding="utf-8")
    verify_store(root)
    print(f"Archived {sum(entry['bytes'] for entry in inventory['files']):,} bytes; session originals untouched")


def restore_store(source, destination):
    if destination.exists():
        raise FileExistsError(f"Refusing to overwrite restore destination: {destination}")
    if source.is_relative_to(destination) or destination.is_relative_to(source):
        raise ValueError("Restore stores must be separate")
    inventory = verify_store(source)
    destination.mkdir(parents=True)
    for entry in inventory["files"]:
        original = inventory_path(source, entry["path"])
        target = inventory_path(destination, entry["path"])
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original, target)
    shutil.copyfile(source / "artifact-inventory.json", destination / "artifact-inventory.json")
    verify_store(destination)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    archive = sub.add_parser("archive-session")
    archive.add_argument("--session-files", required=True, type=Path)
    archive.add_argument("--artifact-root", type=Path)
    verify = sub.add_parser("verify")
    verify.add_argument("--artifact-root", type=Path)
    restore = sub.add_parser("restore", help="Copy a verified archived store to a new external root")
    restore.add_argument("--from-root", required=True, type=Path)
    restore.add_argument("--artifact-root", type=Path)
    args = parser.parse_args()
    root = artifact_root(args.artifact_root)
    if args.command == "archive-session":
        archive_session(args.session_files.resolve(), root)
    elif args.command == "restore":
        restore_store(artifact_root(args.from_root), root)
    else:
        verify_store(root)


if __name__ == "__main__":
    main()
