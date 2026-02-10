import os
import socket
from typing import Dict
from app import config
from app.infra import docker
from app.services.router_store import RouterStore
from app.services import paths
from app.infra.process import run_command


store = RouterStore()


def _get_available_port(used_ports) -> int:
    for port in range(config.OTP_PORT_START, config.OTP_PORT_END):
        if port in used_ports:
            continue
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("localhost", port)) != 0:
                return port
    raise RuntimeError("No available ports in the specified range.")


def _container_name(router_id: str) -> str:
    return f"{config.OTP_ROUTER_CONTAINER_PREFIX}{router_id}"


def generate_nginx_routes(router_map: Dict[str, int]) -> None:
    os.makedirs(config.NGINX_CONFIG_DIR, exist_ok=True)
    for router_id, port in router_map.items():
        conf_file = config.NGINX_CONFIG_DIR / f"{router_id}.conf"
        conf_file.write_text(
            "\n".join(
                [
                    f"location /routers/{router_id}/ {{",
                    f"    rewrite ^/routers/{router_id}/(.*)$ /$1 break;",
                    f"    proxy_pass http://host.docker.internal:{port}/;",
                    "    proxy_set_header Host $host;",
                    "    proxy_http_version 1.1;",
                    "    proxy_set_header Connection \"\";",
                    "}",
                ]
            )
            + "\n",
            encoding="utf-8",
        )


def launch_router(router_id: str) -> None:
    router_id = router_id.replace("\\", "/").strip()
    graph_path = paths.graph_obj_path(router_id)
    if not graph_path.exists():
        print(f"[!] Graph.obj missing at {graph_path}")
        return

    router_map = store.load()
    if router_id in router_map:
        print(f"Router {router_id} already exists.")
        return

    port = _get_available_port(set(router_map.values()))
    container_name = _container_name(router_id)

    docker.docker_run(
        [
            "-d",
            "--name",
            container_name,
            "--network",
            config.DOCKER_NETWORK,
            "-p",
            f"{port}:8080",
            "-e",
            f"ROUTER_ID={router_id}",
            config.OTP_ROUTER_IMAGE,
        ]
    )

    container_graph_dir = f"/app/graphs/{router_id}"
    docker.docker_exec(container_name, ["mkdir", "-p", container_graph_dir])
    docker.docker_cp(str(graph_path), f"{container_name}:{container_graph_dir}/Graph.obj")
    run_command(["docker", "restart", container_name])

    router_map[router_id] = port
    store.save(router_map)

    generate_nginx_routes(router_map)
    run_command(["docker", "exec", "otp-nginx", "nginx", "-s", "reload"])

    print(f"Launched router {router_id} at http://localhost:{port}/otp/routers/{router_id}")


def restart_router(router_id: str) -> None:
    router_id = router_id.replace("\\", "/").strip()
    graph_path = paths.graph_obj_path(router_id)
    container_name = _container_name(router_id)
    container_graph_dir = f"/app/graphs/{router_id}"

    docker.docker_exec(container_name, ["rm", "-f", f"{container_graph_dir}/Graph.obj"])
    docker.docker_cp(str(graph_path), f"{container_name}:{container_graph_dir}/Graph.obj")
    run_command(["docker", "restart", container_name])
    run_command(["docker", "exec", "otp-nginx", "nginx", "-s", "reload"])


def delete_router(router_id: str) -> None:
    router_id = router_id.replace("\\", "/").strip()
    router_map = store.load()

    if router_id not in router_map:
        raise RuntimeError(f"Router '{router_id}' not found in map.")

    container_name = _container_name(router_id)
    docker.docker_stop(container_name)
    docker.docker_rm(container_name)

    del router_map[router_id]
    store.save(router_map)

    pattern = f"{router_id}"
    for cfg_path in config.NGINX_CONFIG_DIR.glob(f"{pattern}*"):
        cfg_path.unlink(missing_ok=True)

    run_command(["docker", "exec", "otp-nginx", "nginx", "-s", "reload"])
