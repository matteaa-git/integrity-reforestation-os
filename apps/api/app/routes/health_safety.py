"""Health & Safety Program — API routes."""

import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel

router = APIRouter(prefix="/hs", tags=["health-safety"])

# ---------------------------------------------------------------------------
# R2 URL map  (populated by upload_hs_to_r2.py)
# ---------------------------------------------------------------------------

_R2_URLS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "hs_r2_urls.json")


def _load_r2_urls() -> Dict[str, str]:
    try:
        with open(_R2_URLS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}


_R2_URLS: Dict[str, str] = _load_r2_urls()

# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

_SUBMISSIONS_FILE = os.path.join(
    os.path.dirname(__file__), "..", "..", "hs_submissions.json"
)


def _load_submissions() -> List[dict]:
    try:
        with open(_SUBMISSIONS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []


def _save_submissions(submissions: List[dict]) -> None:
    try:
        with open(_SUBMISSIONS_FILE, "w") as f:
            json.dump(submissions, f, indent=2)
    except Exception:
        pass


_submissions: List[dict] = _load_submissions()


# ---------------------------------------------------------------------------
# Document Index
# ---------------------------------------------------------------------------

_BASE = "/Users/matthewmckernan/Desktop/Health and Safety Program"

_CATEGORY_FOLDERS: Dict[str, str] = {
    "Administrative & General": "Administrative and General - H&S",
    "Emergency Response":       "Emergency Response - H&S",
    "Equipment":                "Equipment - H&S",
    "Fire Safety":              "Fire - H&S",
    "First Aid":                "First Aid H&S",
    "Hazard Identification":    "Hazard Identification and Response - H&S",
    "Hazardous Materials":      "Hazardous Materials - H&S",
    "Human & Wellness":         "Human Mind and Body - H&S",
    "JHSC":                     "JHSC - H&S",
    "Required Postings":        "Required Postings",
    "Low Risk":                 "Low Risk H&S",
    "Weather & Environment":    "Weather and Environment H&S",
}


def _slugify(name: str) -> str:
    """Convert filename (no extension) to a stable kebab-case ID."""
    name = re.sub(r"[^\w\s-]", "", name).strip()
    name = re.sub(r"[\s_]+", "-", name)
    return name.lower()


def _make_doc(filename: str, category: str, doc_type: str = "policy") -> dict:
    stem = os.path.splitext(filename)[0]
    doc_id = _slugify(stem)
    folder = _CATEGORY_FOLDERS[category]
    path = os.path.join(_BASE, folder, filename)
    return {
        "id":       doc_id,
        "filename": filename,
        "category": category,
        "doc_type": doc_type,
        "path":     path,
    }


# Full document catalogue
_RAW_DOCS: List[dict] = [
    # ── Administrative & General ────────────────────────────────────────────
    _make_doc("Competent Supervisors Policy.docx",                     "Administrative & General"),
    _make_doc("Health and Safety Policy.docx",                         "Administrative & General"),
    _make_doc("Ministry of Labour Orders Policy.docx",                 "Administrative & General"),
    _make_doc("Posting of Workplace Documentation Policy.docx",        "Administrative & General"),
    _make_doc("Return to Work Policy.docx",                            "Administrative & General"),
    _make_doc("Visitor, Supplier and Contractor H&S policy.docx",      "Administrative & General"),
    _make_doc("Wildlife Safety Policy.docx",                           "Administrative & General"),
    _make_doc("Worker Training Policy.docx",                           "Administrative & General"),

    # ── Emergency Response ──────────────────────────────────────────────────
    _make_doc("Chemical Spill - Emergency Response.docx",              "Emergency Response"),
    _make_doc("Emergency Communication Manual.docx",                   "Emergency Response"),
    _make_doc("Emergency Evacuation General Information.docx",         "Emergency Response"),
    _make_doc("Fire - Emergency Response.docx",                        "Emergency Response"),
    _make_doc("Important Phone Numbers and Hospital information.docx",  "Emergency Response", "form"),
    _make_doc("Injury - Emergency Response.docx",                      "Emergency Response"),
    _make_doc("Safe Operation of Motor Vehicle Policy.docx",           "Emergency Response"),

    # ── Equipment ───────────────────────────────────────────────────────────
    _make_doc("ATV Safe Operation Policy.docx",                        "Equipment"),
    _make_doc("Hot Work and Spark Policy.docx",                        "Equipment"),
    _make_doc("Load Securement Policy.docx",                           "Equipment"),
    _make_doc("Lock-out Tag-out Procedures.docx",                      "Equipment"),
    _make_doc("Machine Guarding Program.docx",                         "Equipment"),
    _make_doc("Motor Vehicle Maintenance and Training Policy and Procedure.docx", "Equipment"),
    _make_doc("Restricted Area Access Training Course.docx",           "Equipment"),
    _make_doc("Restricted Area Policy.docx",                           "Equipment"),
    _make_doc("Road Conditions Safe Driving Policy.docx",              "Equipment"),
    _make_doc("Trailer Safety Policy.docx",                            "Equipment"),

    # ── Fire Safety ─────────────────────────────────────────────────────────
    _make_doc("Fire - Emergency Response.docx",                        "Fire Safety"),
    _make_doc("Fire Equipment Inspection Procedure.docx",              "Fire Safety"),
    _make_doc("Fire Prevention Policy and Procedures.docx",            "Fire Safety"),
    _make_doc("Fire Protection Equipment Inventory.docx",              "Fire Safety", "form"),
    _make_doc("Fire Suppression Equipment Inspection Sheet.xlsx",      "Fire Safety", "form"),
    _make_doc("Hot Work and Spark Policy.docx",                        "Fire Safety"),
    _make_doc("Smoking Policy.docx",                                   "Fire Safety"),

    # ── First Aid ───────────────────────────────────────────────────────────
    _make_doc("First Aid Certified List and Info.docx",                "First Aid", "form"),
    _make_doc("First Aid Policy and Procedure.docx",                   "First Aid"),

    # ── Hazard Identification ───────────────────────────────────────────────
    _make_doc("Hazard Recognition (RACE) Policy.docx",                 "Hazard Identification"),
    _make_doc("Health Hazards Monitoring and Control Program.docx",    "Hazard Identification"),
    _make_doc("Workplace Health Hazard Assessment.docx",               "Hazard Identification", "form"),

    # ── Hazardous Materials ─────────────────────────────────────────────────
    _make_doc("Fuel Safety Policy.docx",                               "Hazardous Materials"),
    _make_doc("Fuel Safety Training Module.docx",                      "Hazardous Materials"),
    _make_doc("Integrity Reforestation Official WHMIS Training Document.docx", "Hazardous Materials"),
    _make_doc("Official Propane Training.docx",                        "Hazardous Materials"),

    # ── Human & Wellness ────────────────────────────────────────────────────
    _make_doc("Health Hazards Monitoring and Control Program.docx",    "Human & Wellness"),
    _make_doc("Lost Person Prevention.docx",                           "Human & Wellness"),
    _make_doc("Musculoskeletal Disorder Policy.docx",                  "Human & Wellness"),
    _make_doc("Personal Protective Equipment Training.docx",           "Human & Wellness"),
    _make_doc("Physical demands analysis by position.docx",            "Human & Wellness"),
    _make_doc("Slips, Trips and Falls Policy.docx",                    "Human & Wellness"),
    _make_doc("Working Alone Policy and Procedures.docx",              "Human & Wellness"),

    # ── JHSC ────────────────────────────────────────────────────────────────
    _make_doc("Camp Hazard Inspection Form.docx",                      "JHSC", "form"),
    _make_doc("Fire Equipment Inspection Procedure.docx",              "JHSC"),
    _make_doc("Fire Suppression Equipment Inspection Sheet.xlsx",      "JHSC", "form"),
    _make_doc("Formal Safety Concern Report.docx",                     "JHSC", "form"),
    _make_doc("Hazard Recognition (RACE) Policy.docx",                 "JHSC"),
    _make_doc("Health and Safety Policy.docx",                         "JHSC"),
    _make_doc("Health Hazards Monitoring and Control Program.docx",    "JHSC"),
    _make_doc("Incident Report 2026.docx",                             "JHSC", "form"),
    _make_doc("Investigation Follow-up Report.docx",                   "JHSC", "form"),
    _make_doc("JHSC Charter - Terms of Reference.docx",                "JHSC"),
    _make_doc("JHSC Formal Recommendation.docx",                       "JHSC", "form"),
    _make_doc("JHSC Meeting Minutes.docx",                             "JHSC", "form"),
    _make_doc("JHSC Membership Roster.docx",                           "JHSC", "form"),
    _make_doc("Safety Meeting Attendance Record.docx",                 "JHSC", "form"),
    _make_doc("Workplace Health Hazard Assessment.docx",               "JHSC", "form"),
    _make_doc("Workplace Investigation Report 2026.docx",              "JHSC", "form"),
    _make_doc("Workplace Risk Assessment Template.docx",               "JHSC", "form"),
    _make_doc("Worksite Hazard Inspection Form.docx",                  "JHSC", "form"),

    # ── Required Postings ───────────────────────────────────────────────────
    _make_doc("Employment Standards Poster.pdf",                       "Required Postings"),
    _make_doc("First Aid Certified List and Info.docx",                "Required Postings", "form"),
    _make_doc("Important Phone Numbers and Hospital information.docx",  "Required Postings", "form"),
    _make_doc("JHSC Membership Roster.docx",                           "Required Postings", "form"),
    _make_doc("Prevention Starts Here OHSA Poster.pdf",                "Required Postings"),
    _make_doc("WSIB In Case of Injury Poster.pdf",                     "Required Postings"),

    # ── Low Risk ────────────────────────────────────────────────────────────
    _make_doc("Bulk Storage Structure Policy.docx",                    "Low Risk"),
    _make_doc("Confined Space Policy.docx",                            "Low Risk"),

    # ── Weather & Environment ───────────────────────────────────────────────
    _make_doc("Road Conditions Safe Driving Policy.docx",              "Weather & Environment"),
    _make_doc("Weather Conditions Safety Policy.docx",                 "Weather & Environment"),
    _make_doc("Wildlife Safety Policy.docx",                           "Weather & Environment"),
]

# Deduplicate by (id, category) so same filename in multiple categories
# each gets its own entry but identical (filename, category) pairs are merged.
_seen: set = set()
_DOCUMENTS: List[dict] = []
for _doc in _RAW_DOCS:
    _key = (_doc["id"], _doc["category"])
    if _key not in _seen:
        _seen.add(_key)
        _DOCUMENTS.append(_doc)

_DOC_BY_ID: Dict[str, dict] = {}
for _doc in _DOCUMENTS:
    # When the same id appears in multiple categories, keep first occurrence
    # for download — category-qualified lookup used for listing only.
    if _doc["id"] not in _DOC_BY_ID:
        _DOC_BY_ID[_doc["id"]] = _doc


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class SubmissionCreate(BaseModel):
    form_type: str
    submitted_by: str
    role: str
    data: Dict[str, Any]
    notes: Optional[str] = ""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/documents")
def list_documents(category: Optional[str] = None):
    docs = _DOCUMENTS
    if category and category != "All":
        docs = [d for d in docs if d["category"] == category]
    result = []
    for doc in docs:
        r2_url = _R2_URLS.get(doc["id"])
        result.append({
            **doc,
            "exists": bool(r2_url) or os.path.isfile(doc["path"]),
            "r2_url": r2_url or None,
        })
    return {"documents": result, "total": len(result)}


@router.get("/documents/{doc_id}/file")
def download_document(doc_id: str):
    """Download a document — redirects to R2 if uploaded, otherwise serves from disk."""
    doc = _DOC_BY_ID.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    r2_url = _R2_URLS.get(doc_id)
    if r2_url:
        return RedirectResponse(url=r2_url)
    path = doc["path"]
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        path=path,
        filename=doc["filename"],
        media_type="application/octet-stream",
    )


@router.get("/documents/{doc_id}/preview")
def preview_document(doc_id: str):
    """Serve a PDF inline for embedding — redirects to R2 if uploaded."""
    doc = _DOC_BY_ID.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    ext = os.path.splitext(doc["filename"])[1].lower()
    if ext != ".pdf":
        raise HTTPException(status_code=415, detail="Preview only available for PDF files")
    r2_url = _R2_URLS.get(doc_id)
    if r2_url:
        return RedirectResponse(url=r2_url)
    path = doc["path"]
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(
        path=path,
        filename=doc["filename"],
        media_type="application/pdf",
        headers={"Content-Disposition": "inline"},
    )


@router.post("/submissions", status_code=201)
def create_submission(body: SubmissionCreate):
    submission = {
        "id":           str(uuid.uuid4()),
        "form_type":    body.form_type,
        "submitted_by": body.submitted_by,
        "role":         body.role,
        "data":         body.data,
        "notes":        body.notes or "",
        "created_at":   datetime.now(timezone.utc).isoformat(),
    }
    _submissions.insert(0, submission)
    _save_submissions(_submissions)
    return submission


@router.get("/submissions")
def list_submissions(limit: int = 50):
    return {"submissions": _submissions[:limit], "total": len(_submissions)}


@router.get("/submissions/{submission_id}")
def get_submission(submission_id: str):
    for s in _submissions:
        if s["id"] == submission_id:
            return s
    raise HTTPException(status_code=404, detail="Submission not found")


# ---------------------------------------------------------------------------
# Assignments
# ---------------------------------------------------------------------------

_ASSIGNMENTS_FILE = os.path.join(
    os.path.dirname(__file__), "..", "..", "hs_assignments.json"
)


def _load_assignments() -> List[dict]:
    try:
        with open(_ASSIGNMENTS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []


def _save_assignments(assignments: List[dict]) -> None:
    try:
        with open(_ASSIGNMENTS_FILE, "w") as f:
            json.dump(assignments, f, indent=2)
    except Exception:
        pass


_assignments: List[dict] = _load_assignments()


class AssignmentCreate(BaseModel):
    doc_id: str
    doc_title: str
    assigned_to: str          # recipient name
    assigned_by: str          # sender name
    due_date: Optional[str] = None
    note: Optional[str] = ""


class AssignmentUpdate(BaseModel):
    status: str               # "pending" | "reviewed"


@router.get("/assignments")
def list_assignments():
    return {"assignments": _assignments, "total": len(_assignments)}


@router.post("/assignments", status_code=201)
def create_assignment(body: AssignmentCreate):
    assignment = {
        "id":          str(uuid.uuid4()),
        "doc_id":      body.doc_id,
        "doc_title":   body.doc_title,
        "assigned_to": body.assigned_to,
        "assigned_by": body.assigned_by,
        "due_date":    body.due_date or "",
        "note":        body.note or "",
        "status":      "pending",
        "created_at":  datetime.now(timezone.utc).isoformat(),
    }
    _assignments.insert(0, assignment)
    _save_assignments(_assignments)
    return assignment


@router.patch("/assignments/{assignment_id}")
def update_assignment(assignment_id: str, body: AssignmentUpdate):
    for a in _assignments:
        if a["id"] == assignment_id:
            a["status"] = body.status
            _save_assignments(_assignments)
            return a
    raise HTTPException(status_code=404, detail="Assignment not found")


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: str):
    global _assignments
    _assignments = [a for a in _assignments if a["id"] != assignment_id]
    _save_assignments(_assignments)
