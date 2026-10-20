#!/bin/bash
cd "$(dirname "$0")"
source .venv/bin/activate
python backend/run_backend.py
