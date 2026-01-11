import json
import os
import subprocess
from pathlib import Path

from google.cloud import storage


def getenv_required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def download_blob(client: storage.Client, bucket: str, obj: str, dest: Path) -> bool:
    blob = client.bucket(bucket).blob(obj)
    if not blob.exists():
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    blob.download_to_filename(dest)
    return True


def upload_blob(client: storage.Client, bucket: str, src: Path, obj: str) -> None:
    blob = client.bucket(bucket).blob(obj)
    blob.upload_from_filename(src)


def write_text(dest: Path, content: str) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content, encoding="utf-8")


def run_command(command: list[str], env: dict[str, str]) -> dict[str, str | int]:
    result = subprocess.run(
        command,
        env=env,
        cwd=env.get("WORKDIR", "."),
        capture_output=True,
        text=True,
        check=False,
    )
    return {
        "code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def main() -> None:
    bucket = getenv_required("GCS_BUCKET")
    job_prefix = os.environ.get("GCS_JOB_PREFIX", "jobs").strip("/")
    job_id = getenv_required("JOB_ID")
    reference_gff = getenv_required("REFERENCE_GFF_OBJECT")
    reference_fasta = getenv_required("REFERENCE_FASTA_OBJECT")
    mode = os.environ.get("OUTPUT_MODE", "dna")

    base_prefix = f"{job_prefix}/{job_id}"
    user_code_object = f"{base_prefix}/user.py"
    genes_object = f"{base_prefix}/genes.txt"
    requirements_object = f"{base_prefix}/requirements.txt"
    result_object = f"{base_prefix}/result.fasta"
    answer_object = f"{base_prefix}/answer.fasta"
    status_object = f"{base_prefix}/status.json"
    user_log_object = f"{base_prefix}/user.log"
    answer_log_object = f"{base_prefix}/answer.log"

    workdir = Path("/work")
    workdir.mkdir(parents=True, exist_ok=True)

    client = storage.Client()

    input_gff = workdir / "input.gff"
    input_fasta = workdir / "input.fa"
    genes_path = workdir / "genes.txt"
    user_code_path = workdir / "user.py"
    requirements_path = workdir / "requirements.txt"

    download_blob(client, bucket, reference_gff, input_gff)
    download_blob(client, bucket, reference_fasta, input_fasta)

    if not download_blob(client, bucket, genes_object, genes_path):
        raise RuntimeError("genes.txt not found in GCS")
    if not download_blob(client, bucket, user_code_object, user_code_path):
        raise RuntimeError("user.py not found in GCS")

    has_requirements = download_blob(client, bucket, requirements_object, requirements_path)

    status: dict[str, object] = {
        "jobId": job_id,
        "mode": mode,
        "answer": {},
        "user": {},
    }

    answer_env = {
        **os.environ,
        "OUTPUT_MODE": mode,
        "WORKDIR": str(workdir),
    }
    answer_result = run_command(
        ["python", "/app/answer_generator.py"],
        env=answer_env,
    )
    status["answer"] = answer_result
    write_text(workdir / "answer.log", answer_result["stdout"] + answer_result["stderr"])

    venv_path = workdir / "venv"
    run_command(
        ["python", "-m", "venv", "--system-site-packages", str(venv_path)],
        env=answer_env,
    )

    pip_path = venv_path / "bin" / "pip"
    python_path = venv_path / "bin" / "python"

    if has_requirements:
        run_command(
            [str(pip_path), "install", "--no-cache-dir", "-r", str(requirements_path)],
            env=answer_env,
        )

    user_env = {
        **os.environ,
        "OUTPUT_MODE": mode,
        "WORKDIR": str(workdir),
    }
    user_result = run_command([str(python_path), str(user_code_path)], env=user_env)
    status["user"] = user_result
    write_text(workdir / "user.log", user_result["stdout"] + user_result["stderr"])

    result_path = workdir / "result.fasta"
    answer_path = workdir / "answer.fasta"

    if answer_path.exists():
        upload_blob(client, bucket, answer_path, answer_object)
    if result_path.exists():
        upload_blob(client, bucket, result_path, result_object)

    write_text(workdir / "status.json", json.dumps(status, ensure_ascii=True))
    upload_blob(client, bucket, workdir / "status.json", status_object)
    upload_blob(client, bucket, workdir / "user.log", user_log_object)
    upload_blob(client, bucket, workdir / "answer.log", answer_log_object)


if __name__ == "__main__":
    main()
