# Packages the portfolio into a small container for Cloud Run.
# Google's Cloud Build runs this (your Mac doesn't need to), via `gcloud run deploy --source`.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/
EXPOSE 8080
