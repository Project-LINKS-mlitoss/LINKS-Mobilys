import asyncio
import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

app = FastAPI(title="Mobilys GTFS Validator Service")

# Configuration from environment variables (with sane defaults)
JAR_PATH = Path(os.getenv("GTFS_VALIDATOR_JAR", "/opt/gtfs/gtfs-validator-cli.jar"))
JAVA_HEAP = os.getenv("JAVA_HEAP", "4G")  # e.g. "2G", "4G"
MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_FILE_SIZE_BYTES", str(300 * 1024 * 1024)))  # 300 MB
VALIDATOR_TIMEOUT_SECONDS = int(os.getenv("VALIDATOR_TIMEOUT_SECONDS", "900"))  # 15 minutes
MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "1"))

# Limit concurrency so this service does not kill the node by spawning too many Java processes
_semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)


@app.on_event("startup")
def startup_check() -> None:
    """
    Minimal sanity check when the service starts.
    """
    if not JAR_PATH.exists():
        # Fail fast: better crash at startup than fail all requests later.
        raise RuntimeError(f"GTFS validator JAR does not exist at: {JAR_PATH}")


# Optional CORS (tweak domains if needed, or remove if not necessary)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this for production if needed
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz() -> Dict[str, str]:
    """
    Simple health check endpoint used by ECS / load balancer.
    """
    return {"status": "ok"}


@app.post("/validate")
async def validate_gtfs(file: UploadFile = File(...)) -> JSONResponse:
    """
    Validate a GTFS zip file using the MobilityData GTFS validator CLI.

    Request:
        - multipart/form-data
        - field name: "file"
        - value: GTFS .zip

    Response:
        - JSON content of report.json produced by the validator.

    This endpoint is synchronous: it will run the validator process and
    only return after validation is done.
    """
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are accepted")

    # Ensure we do not oversubscribe CPU with multiple Java processes
    async with _semaphore:
        try:
            return await _run_validation(file)
        except HTTPException:
            # Re-raise HTTP-specific errors as-is
            raise
        except Exception as exc:
            # Catch-all to avoid leaking internal traces
            raise HTTPException(
                status_code=500,
                detail={"message": "Unexpected error while validating GTFS", "error": str(exc)},
            ) from exc


async def _run_validation(file: UploadFile) -> JSONResponse:
    """
    Orchestrates file saving, running the Java validator, and returning report.json.
    Everything is scoped inside a temporary directory.
    """
    with tempfile.TemporaryDirectory(prefix="gtfs_validator_") as tmpdir_str:
        tmpdir = Path(tmpdir_str)
        input_path = tmpdir / "input.zip"
        output_dir = tmpdir / "output"
        output_dir.mkdir(parents=True, exist_ok=True)

        _save_uploaded_file(file, input_path, MAX_FILE_SIZE_BYTES)
        _run_java_validator(input_path, output_dir)

        report_path = output_dir / "report.json"
        if not report_path.exists():
            # We only care about JSON; HTML and others are ignored.
            raise HTTPException(
                status_code=500,
                detail={"message": "report.json not found in validator output"},
            )

        try:
            report_data = json.loads(report_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail={"message": "Failed to parse report.json as JSON", "error": str(exc)},
            ) from exc

        return JSONResponse(content=report_data)


def _save_uploaded_file(file: UploadFile, dest: Path, max_size_bytes: int) -> None:
    """
    Save uploaded file to disk, enforcing a maximum size.
    This function is intentionally synchronous and streaming-based.
    """
    size = 0
    try:
        with dest.open("wb") as f:
            while True:
                chunk = file.file.read(1024 * 1024)  # 1 MB chunks
                if not chunk:
                    break
                size += len(chunk)
                if size > max_size_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Uploaded file exceeds {max_size_bytes} bytes limit",
                    )
                f.write(chunk)
    finally:
        file.file.close()


def _run_java_validator(input_path: Path, output_dir: Path) -> None:
    """
    Execute the GTFS validator CLI using subprocess.
    """
    if not input_path.exists():
        raise HTTPException(
            status_code=400,
            detail={"message": f"Input file does not exist: {input_path}"},
        )

    threads = max(1, (os.cpu_count() or 1))  # simple heuristic

    cmd = [
        "java",
        f"-Xmx{JAVA_HEAP}",
        "-jar",
        str(JAR_PATH),
        "-i",
        str(input_path),
        "-o",
        str(output_dir),
        "-t",
        str(threads),
    ]

    completed = subprocess.run(
        cmd,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=VALIDATOR_TIMEOUT_SECONDS,
    )

    if completed.returncode != 0:
        # Build a compact error payload with useful debug info
        debug_info: Dict[str, Any] = {
            "message": "Validator failed",
            "exit_code": completed.returncode,
        }

        if completed.stdout:
            debug_info["stdout"] = completed.stdout.strip()[:2000]
        if completed.stderr:
            debug_info["stderr"] = completed.stderr.strip()[:2000]

        system_errors_path = output_dir / "system_errors.json"
        if system_errors_path.exists():
            try:
                debug_info["system_errors"] = json.loads(
                    system_errors_path.read_text(encoding="utf-8")
                )
            except json.JSONDecodeError:
                debug_info["system_errors_raw"] = system_errors_path.read_text(
                    encoding="utf-8", errors="ignore"
                )[:2000]

        raise HTTPException(status_code=500, detail=debug_info)
