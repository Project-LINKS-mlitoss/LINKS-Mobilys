from __future__ import annotations

import contextvars
from contextvars import Token
from typing import Optional

_request_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("request_id", default=None)
_user_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("user_id", default=None)
_scenario_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("scenario_id", default=None)


def set_request_id(request_id: str) -> Token:
    return _request_id_var.set(request_id)


def reset_request_id(token: Token) -> None:
    _request_id_var.reset(token)


def get_request_id() -> Optional[str]:
    return _request_id_var.get()


def set_user_id(user_id: str) -> Token:
    return _user_id_var.set(user_id)


def reset_user_id(token: Token) -> None:
    _user_id_var.reset(token)


def get_user_id() -> Optional[str]:
    return _user_id_var.get()


def set_scenario_id(scenario_id: str) -> Token:
    return _scenario_id_var.set(scenario_id)


def reset_scenario_id(token: Token) -> None:
    _scenario_id_var.reset(token)


def get_scenario_id() -> Optional[str]:
    return _scenario_id_var.get()
