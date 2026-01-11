import json
import os
import subprocess
import re
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
    reference_genes = getenv_required("REFERENCE_GENES_OBJECT")
    reference_answer = getenv_required("REFERENCE_ANSWER_OBJECT")
    mode = os.environ.get("OUTPUT_MODE", "dna")

    base_prefix = f"{job_prefix}/{job_id}"
    user_code_object = f"{base_prefix}/user.py"
    requirements_object = f"{base_prefix}/requirements.txt"
    result_object = f"{base_prefix}/result.fasta"
    answer_object = f"{base_prefix}/answer.fasta"
    status_object = f"{base_prefix}/status.json"
    user_log_object = f"{base_prefix}/user.log"

    workdir = Path("/work")
    workdir.mkdir(parents=True, exist_ok=True)

    client = storage.Client()

    input_gff = workdir / "input.gff"
    input_fasta = workdir / "input.fa"
    genes_path = workdir / "genes.txt"
    user_code_path = workdir / "user.py"
    requirements_path = workdir / "requirements.txt"

    if not download_blob(client, bucket, reference_gff, input_gff):
        raise RuntimeError(f"Reference GFF not found: gs://{bucket}/{reference_gff}")
    if not download_blob(client, bucket, reference_fasta, input_fasta):
        raise RuntimeError(f"Reference FASTA not found: gs://{bucket}/{reference_fasta}")
    if not download_blob(client, bucket, reference_genes, genes_path):
        raise RuntimeError(f"Reference genes.txt not found: gs://{bucket}/{reference_genes}")

    answer_path = workdir / "answer.fasta"
    download_blob(client, bucket, reference_answer, answer_path)

    if not download_blob(client, bucket, user_code_object, user_code_path):
        raise RuntimeError("user.py not found in GCS")

    has_requirements = download_blob(client, bucket, requirements_object, requirements_path)

    status: dict[str, object] = {
        "jobId": job_id,
        "mode": mode,
        "answer": {"skipped": True},
        "user": {},
    }

    base_env = {
        **os.environ,
        "OUTPUT_MODE": mode,
        "WORKDIR": str(workdir),
    }

    venv_path = workdir / "venv"
    run_command(
        ["python", "-m", "venv", "--system-site-packages", str(venv_path)],
        env=base_env,
    )

    pip_path = venv_path / "bin" / "pip"
    python_path = venv_path / "bin" / "python"

    if has_requirements:
        run_command(
            [str(pip_path), "install", "--no-cache-dir", "-r", str(requirements_path)],
            env=base_env,
        )

    # /usr/bin/time を使ってメモリと時間を測定（出力をファイルに書き出す）
    time_output_file = workdir / "time_output.txt"
    time_result = subprocess.run(
        ["/usr/bin/time", "-v", "-o", str(time_output_file), str(python_path), str(user_code_path)],
        env=base_env,
        cwd=base_env.get("WORKDIR", "."),
        capture_output=True,
        text=True,
        check=False,
    )

    # /usr/bin/time の出力から実行時間とメモリを抽出
    execution_time = 0.0
    max_memory_kb = 0

    if time_output_file.exists():
        time_output = time_output_file.read_text()

        # "Elapsed (wall clock) time (h:mm:ss or m:ss): 0:00.05" のようなフォーマット
        elapsed_match = re.search(r"Elapsed.*?:\s*(\d+):(\d+\.\d+)", time_output)
        if elapsed_match:
            minutes = int(elapsed_match.group(1))
            seconds = float(elapsed_match.group(2))
            execution_time = minutes * 60 + seconds

        # "Maximum resident set size (kbytes): 12345" のようなフォーマット
        memory_match = re.search(r"Maximum resident set size.*?:\s*(\d+)", time_output)
        if memory_match:
            max_memory_kb = int(memory_match.group(1))

    user_result = {
        "code": time_result.returncode,
        "stdout": time_result.stdout,
        "stderr": time_result.stderr,
    }

    status["user"] = user_result
    status["metrics"] = {
        "execution_time": round(execution_time, 3),
        "max_memory_mb": round(max_memory_kb / 1024, 2),
    }
    write_text(workdir / "user.log", str(user_result["stdout"]) + str(user_result["stderr"]))

    result_path = workdir / "result.fasta"
    if result_path.exists():
        upload_blob(client, bucket, result_path, result_object)

    if answer_path.exists():
        upload_blob(client, bucket, answer_path, answer_object)

    write_text(workdir / "status.json", json.dumps(status, ensure_ascii=True))
    upload_blob(client, bucket, workdir / "status.json", status_object)
    upload_blob(client, bucket, workdir / "user.log", user_log_object)


if __name__ == "__main__":
    main()
