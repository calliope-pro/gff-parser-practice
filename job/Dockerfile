FROM python:3.11-slim

WORKDIR /app

COPY job/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY job/runner.py /app/runner.py
COPY public/answer_generator.py /app/answer_generator.py

RUN useradd -m runner && chown -R runner:runner /app
USER runner

ENV PYTHONUNBUFFERED=1

CMD ["python", "/app/runner.py"]
