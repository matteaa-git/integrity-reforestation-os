"""
One-time script: upload all H&S documents to Cloudflare R2.

Usage (from apps/api/ with venv active):
    python upload_hs_to_r2.py

Writes hs_r2_urls.json — a mapping of {doc_id: r2_public_url} used by the API.
"""

import json
import os
import sys

import boto3
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()

# ── Validate env ──────────────────────────────────────────────────────────────

REQUIRED = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]
missing = [k for k in REQUIRED if not os.environ.get(k)]
if missing:
    print(f"ERROR: Missing env vars: {', '.join(missing)}")
    sys.exit(1)

BUCKET     = os.environ["R2_BUCKET_NAME"]
PUBLIC_URL = os.environ["R2_PUBLIC_URL"].rstrip("/")

# ── R2 client ─────────────────────────────────────────────────────────────────

client = boto3.client(
    "s3",
    endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    config=Config(signature_version="s3v4"),
    region_name="auto",
)

# ── Import document index from the route module ───────────────────────────────

sys.path.insert(0, os.path.dirname(__file__))
from app.routes.health_safety import _DOCUMENTS  # noqa: E402

# ── Upload ────────────────────────────────────────────────────────────────────

CONTENT_TYPES = {
    ".pdf":  "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

url_map: dict[str, str] = {}
skipped = 0
uploaded = 0
errors = 0

for doc in _DOCUMENTS:
    local_path = doc["path"]
    doc_id     = doc["id"]

    if not os.path.isfile(local_path):
        print(f"  SKIP  (not found) {doc['filename']}")
        skipped += 1
        continue

    ext = os.path.splitext(local_path)[1].lower()
    r2_key = f"hs-documents/{doc_id}{ext}"
    content_type = CONTENT_TYPES.get(ext, "application/octet-stream")

    try:
        with open(local_path, "rb") as f:
            client.put_object(
                Bucket=BUCKET,
                Key=r2_key,
                Body=f,
                ContentType=content_type,
            )
        public_url = f"{PUBLIC_URL}/{r2_key}"
        url_map[doc_id] = public_url
        print(f"  OK    {doc['filename']}")
        uploaded += 1
    except Exception as e:
        print(f"  ERROR {doc['filename']}: {e}")
        errors += 1

# ── Save URL map ──────────────────────────────────────────────────────────────

out_path = os.path.join(os.path.dirname(__file__), "hs_r2_urls.json")
with open(out_path, "w") as f:
    json.dump(url_map, f, indent=2)

print(f"\nDone. {uploaded} uploaded, {skipped} skipped, {errors} errors.")
print(f"URL map saved to: {out_path}")
