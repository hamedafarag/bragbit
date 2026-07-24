# bragbit marketing page — static site served by nginx on port 3002
# Build: docker build -t bragbit-site .
# Run:   docker run --rm -p 8080:3002 bragbit-site   ->  http://localhost:8080

FROM nginx:alpine

# Replace nginx's default server (listens on 80) with ours (listens on 3002)
COPY default.conf /etc/nginx/conf.d/default.conf

# The page and everything it serves. index.html loads ./screenshots/*.webp
# (light + dark), and og.png / sitemap.xml / robots.txt are fetched by scrapers
# and crawlers. robots.txt must be copied explicitly — without it, nginx's
# try_files falls back to index.html and /robots.txt serves the HTML page.
COPY index.html og.png sitemap.xml robots.txt /usr/share/nginx/html/
COPY screenshots/ /usr/share/nginx/html/screenshots/

EXPOSE 3002
