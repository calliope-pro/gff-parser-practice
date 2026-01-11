FROM python:3.11-slim

WORKDIR /app

COPY job/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY job/runner.py /app/runner.py

RUN useradd -m runner && \
    mkdir -p /work && \
    chown -R runner:runner /app /work
USER runner

ENV PYTHONUNBUFFERED=1

CMD ["python", "/app/runner.py"]
