# 🚀 Ngrok Setup for Development

## Why do we need ngrok?

Netlify sends webhooks to our server when deploying a project. In production this works automatically, but in development localhost:8080 is not accessible to Netlify.

**Ngrok creates a public tunnel to your local server**, allowing Netlify to send webhooks in development.

## 🔧 Setup

### 1. Get ngrok authtoken

1. Go to [ngrok.com](https://ngrok.com/) and sign up
2. Copy authtoken from [dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Add to `.env.local`:

```bash
NGROK_AUTHTOKEN=your_ngrok_authtoken_here
```

### 2. Run with ngrok

Instead of regular `pnpm dev` use:

```bash
pnpm dev:ngrok
```

This script:

- ✅ Automatically starts ngrok tunnel on port 8080
- ✅ Gets public URL (e.g. `https://abcd-1234.ngrok.io`)
- ✅ Sets `WEBSOCKET_SERVER_URL` for webhooks
- ✅ Starts Next.js dev server
- ✅ All webhooks from Netlify work correctly!

## 📋 What happens automatically?

1. **Ngrok starts** and creates tunnel `localhost:8080` → `https://xxx.ngrok.io`
2. **Netlify webhooks** automatically configured to ngrok URL
3. **Deploy notifications** arrive in real-time
4. **Graceful shutdown** - ngrok stops correctly on Ctrl+C

## 🐛 Troubleshooting

### Error "Failed to start ngrok"

- Check that `NGROK_AUTHTOKEN` is correctly set in `.env.local`
- Make sure port 8080 is free
- System falls back to localhost:8080 if ngrok doesn't work

### Webhooks not arriving

- Check ngrok URL in logs: `✅ Ngrok tunnel ready: https://xxx.ngrok.io`
- Netlify should send webhooks to `{ngrok_url}/webhooks/netlify`
- Check that WebSocket server is running on port 8080

## 🚀 Production

In production ngrok is NOT used. System automatically determines:

- Development: starts ngrok
- Production: uses `WEBSOCKET_SERVER_URL` directly

## ⚡ Quick Start

```bash
# 1. Get ngrok authtoken and add to .env.local
echo "NGROK_AUTHTOKEN=your_token" >> .env.local

# 2. Run with ngrok
pnpm dev:ngrok

# 3. Create project in browser - webhooks work!
```

---

**💡 Tip:** You can continue using regular `pnpm dev` if you don't need webhooks from Netlify in development.
