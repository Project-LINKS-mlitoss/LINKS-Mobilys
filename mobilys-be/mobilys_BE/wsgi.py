# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
"""
WSGI config for mobilys_BE project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os


from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mobilys_BE.settings')

application = get_wsgi_application()
