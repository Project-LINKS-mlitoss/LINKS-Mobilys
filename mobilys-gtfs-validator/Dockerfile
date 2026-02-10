FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends openjdk-21-jdk-headless && \
    rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    GTFS_VALIDATOR_JAR=/opt/gtfs/gtfs-validator-cli.jar \
    JAVA_HEAP=4G \
    MAX_FILE_SIZE_BYTES=314572800 \
    VALIDATOR_TIMEOUT_SECONDS=900 \
    MAX_CONCURRENT_JOBS=1


COPY gtfs-validator-cli.jar ${GTFS_VALIDATOR_JAR}

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8003

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
