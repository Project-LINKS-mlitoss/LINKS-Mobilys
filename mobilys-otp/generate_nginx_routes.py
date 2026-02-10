import json, os
import environ

env = environ.Env()
env.read_env()

INTERNAL_URL = env("INTERNAL_URL", default="http://host.docker.internal")

ROUTER_MAP_FILE = "router_map.json"
NGINX_CONFIG_DIR = "nginx/router_configs"
os.makedirs(NGINX_CONFIG_DIR, exist_ok=True)

with open(ROUTER_MAP_FILE) as f:
    router_map = json.load(f)

for router_id, port in router_map.items():
    conf_file = os.path.join(NGINX_CONFIG_DIR, f"{router_id}.conf")
    with open(conf_file, "w") as f:
        f.write(f"""
location /routers/{router_id}/ {{
    rewrite ^/routers/{router_id}/(.*)$ /$1 break;
    proxy_pass {INTERNAL_URL}:{port}/;
    proxy_set_header Host $host;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
}}
""")
print("Nginx routes generated.")
