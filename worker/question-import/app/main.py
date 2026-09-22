import io
import os
import re
import tempfile
from pathlib import Path

from docling.document_converter import DocumentConverter
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, status
from supabase import Client, create_client

app = FastAPI(title="HPTTS question import worker")
supabase_url = os.environ.get("SUPABASE_URL", "")
service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
worker_token = os.environ.get("QUESTION_IMPORT_WORKER_TOKEN", "")


def database() -> Client:
    if not supabase_url or not service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return create_client(supabase_url, service_role_key)


def require_token(authorization: str | None) -> None:
    if authorization != f"Bearer {worker_token}" or not worker_token:
        raise HTTPException(status_code=401, detail="Unauthorized")


def split_questions(markdown: str) -> list[dict]:
    matches = list(re.finditer(r"(?im)^\s*(?:câu|question)\s*(\d+)\s*[.:)]\s*", markdown))
    if not matches:
        return [{"stem": markdown.strip(), "options": [], "answer_key": "", "issues": ["Không nhận diện được số câu hỏi."]}] if markdown.strip() else []
    drafts: list[dict] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        block = markdown[match.end():end].strip()
        option_matches = list(re.finditer(r"(?im)^\s*([A-J])[.)]\s+(.+)$", block))
        stem = block[:option_matches[0].start()].strip() if option_matches else block
        options = [{"id": item.group(1).upper(), "text": item.group(2).strip()} for item in option_matches]
        issues = []
        if len(options) < 2:
            issues.append("Cần kiểm tra lại lựa chọn và đáp án sau khi tách tài liệu.")
        drafts.append({"stem": stem, "options": options, "answer_key": "", "issues": issues})
    return drafts


def extract_images(document: object, job_id: str, db: Client) -> list[str]:
    image_paths: list[str] = []
    pictures = getattr(document, "pictures", [])
    for index, picture in enumerate(pictures):
        image = picture.get_image(document)
        if image is None:
            continue
        output = io.BytesIO()
        image.save(output, format="PNG")
        path = f"extracted/{job_id}/{index + 1}.png"
        db.storage.from_("question-imports").upload(
            path,
            output.getvalue(),
            {"content-type": "image/png", "upsert": "false"},
        )
        image_paths.append(path)
    return image_paths


def process_import(job_id: str) -> None:
    db = database()
    job_response = db.table("question_import_jobs").select("id, source_file_name, source_file_path").eq("id", job_id).single().execute()
    job = job_response.data
    if not job:
        return
    db.table("question_import_jobs").update({"status": "processing", "error_message": None}).eq("id", job_id).execute()
    try:
        source = db.storage.from_("question-imports").download(job["source_file_path"])
        suffix = Path(job["source_file_name"]).suffix or ".bin"
        with tempfile.TemporaryDirectory() as temp_dir:
            source_path = Path(temp_dir) / f"source{suffix}"
            source_path.write_bytes(source)
            result = DocumentConverter().convert(str(source_path))
            markdown = result.document.export_to_markdown()
            image_paths = extract_images(result.document, job_id, db)
        drafts = split_questions(markdown)
        rows = [
            {
                "job_id": job_id,
                "sequence_number": index + 1,
                "payload": {"stem": draft["stem"], "options": draft["options"], "answerKey": draft["answer_key"], "questionType": "single_choice"},
                "image_paths": image_paths,
                "confidence": 0.85 if not draft["issues"] else 0.45,
                "validation_issues": draft["issues"] + (["Hình đã tách cần được gán đúng câu hỏi khi rà soát."] if image_paths else []),
            }
            for index, draft in enumerate(drafts)
        ]
        if rows:
            db.table("question_import_drafts").insert(rows).execute()
        db.table("question_import_jobs").update({"status": "review_required", "total_drafts": len(rows)}).eq("id", job_id).execute()
    except Exception as error:
        db.table("question_import_jobs").update({"status": "failed", "error_message": str(error)[:1000]}).eq("id", job_id).execute()


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/jobs/{job_id}", status_code=status.HTTP_202_ACCEPTED)
def enqueue_job(job_id: str, background_tasks: BackgroundTasks, authorization: str | None = Header(default=None)) -> dict:
    require_token(authorization)
    background_tasks.add_task(process_import, job_id)
    return {"job_id": job_id, "accepted": True}
