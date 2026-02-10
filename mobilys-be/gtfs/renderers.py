import json

from rest_framework.renderers import BaseRenderer


class XlsxPassthroughRenderer(BaseRenderer):
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    format = "xlsx"
    charset = None
    render_style = "binary"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b""
        if isinstance(data, (bytes, bytearray)):
            return bytes(data)
        if isinstance(data, str):
            return data.encode("utf-8")
        return json.dumps(data).encode("utf-8")


class CsvPassthroughRenderer(BaseRenderer):
    media_type = "text/csv"
    format = "csv"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return ""
        if isinstance(data, (bytes, bytearray)):
            return bytes(data).decode("utf-8", errors="replace")
        if isinstance(data, str):
            return data
        return json.dumps(data)

