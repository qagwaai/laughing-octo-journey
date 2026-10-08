import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from artifact_store import REPOSITORY, SCHEMA, artifact_root, inventory_path, restore_store, verify_store


class ArtifactStoreTests(unittest.TestCase):
    def make_store(self, directory):
        directory.mkdir()
        path = directory / "sources" / "earth" / "original.bin"
        path.parent.mkdir(parents=True)
        path.write_bytes(b"retained-original")
        inventory = {"schema": SCHEMA, "files": [{
            "path": "sources/earth/original.bin", "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }]}
        (directory / "artifact-inventory.json").write_text(json.dumps(inventory))
        return path

    def test_requires_explicit_root_or_environment(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "Specify"):
                artifact_root()
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"SOL_TEXTURE_ARTIFACT_ROOT": directory}):
                self.assertEqual(artifact_root(), Path(directory).resolve())

    def test_rejects_repository_and_ancestor(self):
        for path in [REPOSITORY, REPOSITORY / "originals", REPOSITORY.parent]:
            with self.assertRaisesRegex(ValueError, "outside"):
                artifact_root(path)

    def test_inventory_cannot_escape_root(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "escapes"):
                inventory_path(Path(directory).resolve(), "../outside.bin")

    def test_restore_to_alternate_root_and_refuse_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            source, destination = Path(directory) / "archive", Path(directory) / "other-environment"
            self.make_store(source)
            restore_store(source, destination)
            self.assertEqual(verify_store(source), verify_store(destination))
            with self.assertRaises(FileExistsError):
                restore_store(source, destination)

    def test_detects_corruption_before_restore(self):
        with tempfile.TemporaryDirectory() as directory:
            source, destination = Path(directory) / "archive", Path(directory) / "restore"
            path = self.make_store(source)
            path.write_bytes(b"corrupt")
            with self.assertRaisesRegex(ValueError, "integrity"):
                restore_store(source, destination)
            self.assertFalse(destination.exists())


if __name__ == "__main__":
    unittest.main()
