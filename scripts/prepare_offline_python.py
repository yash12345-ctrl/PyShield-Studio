#!/usr/bin/env python3
"""
PyShield Studio - Offline Standalone Python Runtime Preparer
Downloads a standalone, relocatable Python distribution and installs
backend dependencies into it so the application functions 100% offline
on any end-user machine without requiring internet or Python pre-installed.
"""

import os
import sys
import shutil
import tarfile
import urllib.request
import subprocess
import argparse

# Force UTF-8 on Windows runners where default encoding is CP1252
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RUNTIME_DIR = os.path.join(PROJECT_ROOT, "frontend", "python-runtime")
REQUIREMENTS_FILE = os.path.join(PROJECT_ROOT, "backend", "requirements.txt")

# Indygreg python-build-standalone URLs (relocatable standalone CPython 3.12)
STANDALONE_URLS = {
    "windows": "https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.12.3+20240415-x86_64-pc-windows-msvc-install_only.tar.gz",
    "linux": "https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.12.3+20240415-x86_64-unknown-linux-gnu-install_only.tar.gz"
}

def download_file(url: str, dest_path: str):
    print(f"Downloading standalone Python runtime from:\n  {url}")
    print(f"Saving to:\n  {dest_path}")
    
    def report_progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100.0, downloaded * 100 / total_size)
            mb = downloaded / (1024 * 1024)
            total_mb = total_size / (1024 * 1024)
            sys.stdout.write(f"\r  Progress: {percent:.1f}% ({mb:.1f} MB / {total_mb:.1f} MB)")
            sys.stdout.flush()

    urllib.request.urlretrieve(url, dest_path, reporthook=report_progress)
    print("\n[OK] Download completed.")

def extract_archive(archive_path: str, target_dir: str):
    print(f"Extracting runtime to {target_dir}...")
    temp_extract = os.path.join(target_dir, "_temp_extract")
    os.makedirs(temp_extract, exist_ok=True)
    
    with tarfile.open(archive_path, "r:gz") as tar:
        tar.extractall(temp_extract)
        
    extracted_python = os.path.join(temp_extract, "python")
    if os.path.exists(extracted_python):
        for item in os.listdir(extracted_python):
            src = os.path.join(extracted_python, item)
            dst = os.path.join(target_dir, item)
            if os.path.exists(dst):
                if os.path.isdir(dst):
                    shutil.rmtree(dst)
                else:
                    os.remove(dst)
            shutil.move(src, dst)
        shutil.rmtree(temp_extract)
    else:
        for item in os.listdir(temp_extract):
            src = os.path.join(temp_extract, item)
            dst = os.path.join(target_dir, item)
            if os.path.exists(dst):
                if os.path.isdir(dst):
                    shutil.rmtree(dst)
                else:
                    os.remove(dst)
            shutil.move(src, dst)
        shutil.rmtree(temp_extract)

    print("[OK] Extraction completed.")

def install_requirements(python_exe: str):
    if not os.path.exists(REQUIREMENTS_FILE):
        print(f"No requirements file found at {REQUIREMENTS_FILE}. Skipping pip install.")
        return

    print(f"Installing offline packages using {python_exe}...")
    subprocess.check_call([
        python_exe, "-m", "pip", "install", "--upgrade", "pip"
    ])
    subprocess.check_call([
        python_exe, "-m", "pip", "install", "--no-warn-script-location", "-r", REQUIREMENTS_FILE
    ])
    print("[OK] Offline dependencies successfully installed into runtime.")

def clean_runtime(target_dir: str):
    print("Cleaning unnecessary caches from bundled runtime...")
    for root, dirs, files in os.walk(target_dir, topdown=False):
        for d in dirs:
            if d == "__pycache__" or d == "test" or d == "tests":
                try:
                    shutil.rmtree(os.path.join(root, d))
                except Exception:
                    pass
        for f in files:
            if f.endswith(".pyc") or f.endswith(".pyo"):
                try:
                    os.remove(os.path.join(root, f))
                except Exception:
                    pass
    print("[OK] Bundled runtime optimized.")

def main():
    parser = argparse.ArgumentParser(description="Prepare offline standalone Python runtime for PyShield")
    parser.add_argument("--platform", choices=["windows", "linux"], default="windows",
                        help="Target platform (default: windows)")
    args = parser.parse_args()

    os.makedirs(RUNTIME_DIR, exist_ok=True)
    archive_name = f"python-standalone-{args.platform}.tar.gz"
    archive_path = os.path.join(PROJECT_ROOT, archive_name)

    url = STANDALONE_URLS.get(args.platform)
    if not url:
        print(f"Unsupported platform: {args.platform}")
        sys.exit(1)

    try:
        download_file(url, archive_path)
        extract_archive(archive_path, RUNTIME_DIR)

        # On the runner that matches the target platform, pip install dependencies
        is_current_platform = (args.platform == "windows" and sys.platform == "win32") or \
                              (args.platform == "linux" and sys.platform.startswith("linux"))

        if is_current_platform:
            py_bin = os.path.join(RUNTIME_DIR, "python.exe") if args.platform == "windows" else os.path.join(RUNTIME_DIR, "bin", "python3")
            if os.path.exists(py_bin):
                install_requirements(py_bin)
                clean_runtime(RUNTIME_DIR)
        else:
            print(f"Target platform ({args.platform}) differs from build host ({sys.platform}). Skipping pip execution on host.")

    finally:
        if os.path.exists(archive_path):
            try:
                os.remove(archive_path)
            except Exception:
                pass

    print(f"\n=======================================================")
    print(f"[OK] Standalone offline Python runtime is ready at:\n  {RUNTIME_DIR}")
    print(f"=======================================================")

if __name__ == "__main__":
    main()
