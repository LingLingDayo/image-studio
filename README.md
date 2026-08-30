# GPT Image Studio

独立的纯前端生图工作台，兼容 OpenAI Images API。作品只存在当前浏览器 IndexedDB，删除即从本地抹掉。

## 快速开始

```bash
cp .env.example .env.development.local
# 按需填写 VITE_IMAGE_API_BASE_URL / VITE_IMAGE_API_KEY
npm install
npm run dev
```

未配置环境变量时，在页面右上角设置里填写 OpenAI 兼容的 Base URL 与 API Key。

## 配置

全部通过环境变量覆盖，源码不含特定部署域名。

| 变量 | 作用 | 默认 |
| :--- | :--- | :--- |
| `VITE_IMAGE_API_BASE_URL` | 开发/构建时预填的接口地址 | 空，需在界面填写 |
| `VITE_IMAGE_API_KEY` | 开发/构建时预填的令牌 | 空 |
| `BIND_HOST` | 容器端口绑定地址 | `127.0.0.1`（仅本机） |
| `HOST_PORT` | 宿主机端口 | `3000` |
| `NGINX_FRAME_ANCESTORS` | 允许嵌入本页的 iframe 父来源 | `*`（任意站点） |

说明：

- 想对公网直接暴露：`.env` 里设 `BIND_HOST=0.0.0.0`
- 只给本机 Tunnel / 反代：保持 `BIND_HOST=127.0.0.1`
- 作为其它后台（如 sub2api 自定义菜单）的 iframe：把 `NGINX_FRAME_ANCESTORS` 设成该后台的 origin，例如 `https://gateway.example.com`
- `VITE_*` 只在 `npm run dev` / `npm run build` 时注入。不要把真实 Key 打进公开生产包

## Docker

先本地构建静态资源，再启动 Nginx 容器（镜像内不跑 Node）：

```bash
cp .env.example .env
npm run build
docker compose up -d --build
```

默认监听 `http://127.0.0.1:3000`。
