from typing import List
from app.infra.process import run_command


def docker_run(args: List[str]):
    return run_command(["docker", "run", *args])


def docker_exec(container: str, args: List[str]):
    return run_command(["docker", "exec", container, *args])


def docker_cp(src: str, dest: str):
    return run_command(["docker", "cp", src, dest])


def docker_stop(container: str):
    return run_command(["docker", "stop", container])


def docker_rm(container: str):
    return run_command(["docker", "rm", container])