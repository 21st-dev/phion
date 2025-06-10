# 🚀 Ngrok Setup для Development

## Зачем нужен ngrok?

Netlify отправляет webhooks на наш сервер при деплое проекта. В production это работает автоматически, но в development localhost:8080 недоступен для Netlify.

**Ngrok создает публичный туннель к локальному серверу**, позволяя Netlify отправлять webhooks в development.

## 🔧 Настройка

### 1. Получи ngrok authtoken

1. Зайди на [ngrok.com](https://ngrok.com/) и зарегистрируйся
2. Скопируй authtoken из [dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Добавь в `.env.local`:

```bash
NGROK_AUTHTOKEN=your_ngrok_authtoken_here
```

### 2. Запуск с ngrok

Вместо обычного `pnpm dev` используй:

```bash
pnpm dev:ngrok
```

Этот скрипт:

- ✅ Автоматически запускает ngrok туннель на порт 8080
- ✅ Получает публичный URL (например `https://abcd-1234.ngrok.io`)
- ✅ Устанавливает `WEBSOCKET_SERVER_URL` для webhooks
- ✅ Запускает Next.js dev сервер
- ✅ Все webhooks от Netlify работают корректно!

## 📋 Что происходит автоматически?

1. **Ngrok запускается** и создает туннель `localhost:8080` → `https://xxx.ngrok.io`
2. **Netlify webhooks** автоматически настраиваются на ngrok URL
3. **Уведомления о деплое** приходят в реальном времени
4. **Graceful shutdown** - ngrok корректно останавливается при Ctrl+C

## 🐛 Troubleshooting

### Ошибка "Failed to start ngrok"

- Проверь что `NGROK_AUTHTOKEN` правильно установлен в `.env.local`
- Убедись что порт 8080 свободен
- Система fallback к localhost:8080 если ngrok не работает

### Webhooks не приходят

- Проверь в логах ngrok URL: `✅ Ngrok tunnel ready: https://xxx.ngrok.io`
- Netlify должен отправлять webhooks на `{ngrok_url}/webhooks/netlify`
- Проверь что WebSocket сервер запущен на порту 8080

## 🚀 Production

В production ngrok НЕ используется. Система автоматически определяет:

- Development: запускает ngrok
- Production: использует `WEBSOCKET_SERVER_URL` напрямую

## ⚡ Быстрый старт

```bash
# 1. Получи ngrok authtoken и добавь в .env.local
echo "NGROK_AUTHTOKEN=your_token" >> .env.local

# 2. Запусти с ngrok
pnpm dev:ngrok

# 3. Создай проект в браузере - webhooks работают!
```

---

**💡 Tip:** Можешь продолжать использовать обычный `pnpm dev` если тебе не нужны webhooks от Netlify в development.
