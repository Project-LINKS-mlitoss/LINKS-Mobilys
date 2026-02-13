# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.routes import router
from app.services.router_store import RouterStore
from app.infra.process import run_command
from app import config
import logging

logger = logging.getLogger(__name__)


def start_existing_routers():
    """Start all existing OTP router containers on startup."""
    store = RouterStore()
    router_map = store.load()

    if not router_map:
        logger.info("No existing routers found in router_map.json")
        return

    logger.info(f"Found {len(router_map)} existing router(s), attempting to start...")

    for router_id, port in router_map.items():
        container_name = f"otp-{router_id}"
        try:
            run_command(["docker", "start", container_name])
            logger.info(f"Started router container: {container_name} on port {port}")
            # Connect to the correct network after starting
            try:
                run_command(["docker", "network", "connect", config.DOCKER_NETWORK, container_name])
                logger.info(f"Connected {container_name} to network {config.DOCKER_NETWORK}")
            except Exception:
                # May already be connected, ignore error
                pass
        except Exception as e:
            logger.warning(f"Failed to start router {container_name}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_existing_routers()
    yield
    # Shutdown (nothing to do)


app = FastAPI(lifespan=lifespan)
app.include_router(router)