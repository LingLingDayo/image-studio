# 仅打包本地预构建的 dist，不在服务器上跑 Node 构建
FROM nginx:1.28-alpine

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY dist /usr/share/nginx/html

EXPOSE 80
