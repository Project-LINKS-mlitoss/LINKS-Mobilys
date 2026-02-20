FROM python:3.12-slim

ARG GTFS_VALIDATOR_VERSION=7.1.0
ARG GTFS_VALIDATOR_BASE_URL=https://github.com/MobilityData/gtfs-validator/releases/download

RUN apt-get update && \
    apt-get install -y --no-install-recommends openjdk-21-jdk-headless curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    GTFS_VALIDATOR_JAR=/opt/gtfs/gtfs-validator-cli.jar \
    JAVA_HEAP=4G \
    MAX_FILE_SIZE_BYTES=314572800 \
    VALIDATOR_TIMEOUT_SECONDS=900 \
    MAX_CONCURRENT_JOBS=1

RUN set -eux; \
    jar_url="${GTFS_VALIDATOR_BASE_URL}/v${GTFS_VALIDATOR_VERSION}/gtfs-validator-${GTFS_VALIDATOR_VERSION}-cli.jar"; \
    mkdir -p /opt/gtfs; \
    curl -fL "${jar_url}" -o "${GTFS_VALIDATOR_JAR}"

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8003

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
