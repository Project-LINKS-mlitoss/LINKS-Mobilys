import requests
from urllib.parse import urlparse
from django.http import HttpResponse, HttpResponseBadRequest
from django.views.decorators.http import require_GET

from visualization.utils.tile_proxy_util import (
    greyscale_bytes_from_upstream,
)

from visualization.constants import (
    TILE_PROXY_ALLOWED_HOSTS,
    TILE_PROXY_TIMEOUT_SECONDS,
    TILE_PROXY_USER_AGENT,
    TILE_PROXY_DEFAULT_CACHE_CONTROL,
)

@require_GET
def tile_proxy(request):
    """
    GET /tile-proxy?url=<ENCODED_UPSTREAM_URL>[&mode=gray]
    - Validates host
    - Streams the image
    - If mode=gray, converts to greyscale server-side and returns PNG
    - Adds CORS so html2canvas can read the pixels
    """
    src = request.GET.get("url")
    if not src:
        return HttpResponseBadRequest("Missing url")

    try:
        parsed = urlparse(src)
    except Exception:
        return HttpResponseBadRequest("Bad url")

    if parsed.hostname not in TILE_PROXY_ALLOWED_HOSTS:
        return HttpResponseBadRequest("Host not allowed")

    mode = request.GET.get("mode", "").lower()

    try:
        upstream = requests.get(
            src,
            stream=True,
            timeout=TILE_PROXY_TIMEOUT_SECONDS,
            headers={"User-Agent": TILE_PROXY_USER_AGENT},
        )
    except Exception as e:
        return HttpResponse(f"Upstream error: {e}", status=502)

    if upstream.status_code != 200:
        return HttpResponse(upstream.content, status=upstream.status_code)

    # Raw bytes
    raw = upstream.content
    upstream_ct = upstream.headers.get("Content-Type", "image/png")

    if mode in ("gray", "grey", "greyscale", "grayscale"):
        try:
            out_bytes = greyscale_bytes_from_upstream(raw)
            # always return PNG after conversion
            content_type = "image/png"
        except Exception as e:
            out_bytes = raw
            content_type = upstream_ct
    else:
        out_bytes = raw
        content_type = upstream_ct

    resp = HttpResponse(out_bytes, content_type=content_type)
    # allow html2canvas to read pixels
    resp["Access-Control-Allow-Origin"] = "*"

    if "Cache-Control" in upstream.headers:
        resp["Cache-Control"] = upstream.headers["Cache-Control"]
    else:
        resp["Cache-Control"] = TILE_PROXY_DEFAULT_CACHE_CONTROL

    return resp
