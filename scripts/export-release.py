"""Export shareable Windows and source archives without user data (Python 3)."""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIRS = ("src", "scripts", "tests", "assets", "docs", ".github")
SOURCE_FILES = ("package.json", "tsconfig.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".gitignore", ".gitattributes", "README.md", "LICENSE", "THIRD_PARTY.md", "CONTRIBUTING.md", "CHANGELOG.md")

def source_files():
    files = [ROOT / name for name in SOURCE_FILES]
    for name in SOURCE_DIRS:
        files.extend(p for p in (ROOT / name).rglob("*") if p.is_file() and p.name != "probe-drag.mjs" and "__pycache__" not in p.parts)
    return sorted(files)

def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime", type=Path, default=ROOT / "release/win-unpacked")
    parser.add_argument("--output", type=Path, default=ROOT / "release/github")
    args = parser.parse_args()
    runtime, output = args.runtime.resolve(), args.output.resolve()
    version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    assert (runtime / "Piggy.exe").is_file(), "Build the Windows runtime first."
    assert (runtime / "resources/third-party-licenses.txt").is_file(), "Run node scripts/notices.mjs first."
    output.mkdir(parents=True, exist_ok=True)
    binary = output / f"Piggy-Windows-x64-v{version}.zip"
    source = output / f"Piggy-Source-v{version}.zip"
    sums = output / "SHA256SUMS.txt"
    assert not any(p.exists() for p in (binary, source, sums)), "Existing release files are preserved; choose another output directory."
    docs = {"README.md": "使用说明.md", "LICENSE": "LICENSE", "assets/LICENSE.md": "Piggy素材许可.md", "THIRD_PARTY.md": "第三方说明.md", "CHANGELOG.md": "CHANGELOG.md"}
    replaced = set(docs.values())
    with zipfile.ZipFile(binary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, strict_timestamps=False) as archive:
        for path in sorted(runtime.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(runtime)
            assert not path.is_symlink(), "Unexpected symlink in runtime."
            assert not any(part.lower() in (".test-data", "chats", "attachments", "node_modules") for part in relative.parts), "Unexpected user data in runtime."
            assert path.name.lower() not in ("secret.bin", ".env", "settings.json"), "Unexpected private configuration."
            if relative.as_posix() not in replaced:
                archive.write(path, "Piggy/" + relative.as_posix())
        for original, name in docs.items():
            archive.write(ROOT / original, "Piggy/" + name)
        # Keep relative screenshot/license links functional in the bundled README.
        for path in sorted((ROOT / "docs").rglob("*")):
            if path.is_file():
                archive.write(path, "Piggy/" + path.relative_to(ROOT).as_posix())
        archive.write(ROOT / "assets/LICENSE.md", "Piggy/assets/LICENSE.md")
        archive.write(ROOT / "CONTRIBUTING.md", "Piggy/CONTRIBUTING.md")
    with zipfile.ZipFile(source, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, strict_timestamps=False) as archive:
        for path in source_files():
            assert path.is_file() and not path.is_symlink(), f"Missing or linked source: {path.name}"
            archive.write(path, "piggy-desktop/" + path.relative_to(ROOT).as_posix())
    for path in (binary, source):
        with zipfile.ZipFile(path) as archive:
            assert archive.testzip() is None, f"Corrupt archive: {path.name}"
    sums.write_text("".join(f"{sha256(path)}  {path.name}\n" for path in (binary, source)), encoding="utf-8")
    print(json.dumps({"version": version, "artifacts": [{"name": p.name, "bytes": p.stat().st_size} for p in (binary, source, sums)]}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
