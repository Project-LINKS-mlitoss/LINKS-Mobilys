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


def _container_name(router_id: str) -> str:
    return f"{config.OTP_ROUTER_CONTAINER_PREFIX}{router_id}"


def start_existing_routers():
    """Start all existing OTP router containers on startup."""
    store = RouterStore()
    router_map = store.load()

    if not router_map:
        logger.info("No existing routers found in router_map.json")
        return

    logger.info(f"Found {len(router_map)} existing router(s), attempting to start...")

    for router_id, port in router_map.items():
        container_name = _container_name(router_id)
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


def cleanup_dynamic_routers_on_shutdown() -> None:
    """
    Stop dynamic OTP router containers before `docker compose down` completes.
    Routers are kept (not removed), so they can be started again on the next startup.
    """
    store = RouterStore()
    router_map = store.load()

    if not router_map:
        logger.info("No dynamic routers to stop on shutdown.")
        return

    logger.info(f"Stopping {len(router_map)} dynamic router container(s) on shutdown...")

    for router_id in router_map:
        container_name = _container_name(router_id)
        stop_result = run_command(["docker", "stop", container_name], capture_output=True)
        stop_stderr = (stop_result.stderr or "").strip()

        if stop_result.returncode != 0 and "No such container" not in stop_stderr:
            logger.warning(f"Failed to stop router container {container_name}: {stop_stderr}")
            continue

        # Disconnect from compose network so `docker compose down` can remove the network.
        disconnect_result = run_command(
            ["docker", "network", "disconnect", config.DOCKER_NETWORK, container_name],
            capture_output=True,
        )
        disconnect_stderr = (disconnect_result.stderr or "").strip()
        if (
            disconnect_result.returncode != 0
            and "No such container" not in disconnect_stderr
            and "No such network" not in disconnect_stderr
            and "is not connected" not in disconnect_stderr
        ):
            logger.warning(
                f"Failed to disconnect {container_name} from network {config.DOCKER_NETWORK}: "
                f"{disconnect_stderr}"
            )
        else:
            logger.info(f"Stopped router container: {container_name}")

    logger.info("Dynamic router stop on shutdown complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_existing_routers()
    yield
    # Shutdown handled by container entrypoint signal trap.


app = FastAPI(lifespan=lifespan)
app.include_router(router)
