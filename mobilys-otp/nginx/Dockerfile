FROM nginx:1.25-alpine
RUN apk add --no-cache inotify-tools bash

# Your existing config (keep your default.conf, etc.)
COPY default.conf /etc/nginx/conf.d/default.conf

# Include dynamic router snippets:
RUN mkdir -p /etc/nginx/conf.d/routers
RUN sed -i '1i include /etc/nginx/conf.d/_resolver.conf;' /etc/nginx/nginx.conf
RUN echo "include /etc/nginx/conf.d/routers/*.conf;" >> /etc/nginx/conf.d/default.conf

# Entry: write resolver from /etc/resolv.conf, then watch for changes & reload
COPY docker-entrypoint.sh /docker-entrypoint.d/90-watch-routers.sh
