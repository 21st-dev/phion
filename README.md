# 🚀 Phion.dev

Платформа для редактирования фронтенд-кода с автоматической синхронизацией и деплоем.

## 🛠️ Локальная разработка

### Настройка окружения

1. Скопируйте `env.example` в `.env.local`:

```bash
cp env.example .env.local
```

2. Убедитесь, что в `.env.local` установлено:

```bash
NODE_ENV=development
```

3. Запустите платформу:

```bash
pnpm run dev:all
```

### Тестирование с проектами

Теперь когда вы создадите проект через веб-интерфейс:

- **Локальная разработка**: `phion.config.json` будет содержать `ws://localhost:8080`
- **Продакшн**: `phion.config.json` будет содержать `wss://api.phion.com`

URL автоматически определяется на основе `NODE_ENV`.

### Структура проекта

```
shipvibes/
├── apps/
│   ├── web/                 # Next.js веб-приложение (порт 3004)
│   └── websocket-server/    # WebSocket сервер (порт 8080)
├── packages/
│   ├── database/           # Supabase интеграция
│   ├── dev-agent/          # npm пакет phion для синхронизации
│   ├── shared/             # Общие типы и утилиты
│   └── storage/            # Cloudflare R2 (устаревшее)
└── templates/
    └── vite-react/         # Шаблон проекта для пользователей
```

## 🔧 Технологии

- **Frontend**: Next.js 15, React 18, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, Socket.IO
- **Database**: Supabase (PostgreSQL)
- **File Storage**: GitHub (через GitHub App)
- **Deploy**: Netlify
- **Sync**: WebSocket + File Watcher (chokidar)

## 📋 Workflow

1. **Создание проекта**: Пользователь создает проект в веб-интерфейсе
2. **Скачивание**: Получает ZIP с настроенным шаблоном
3. **Локальная разработка**: Запускает `pnpm start` (dev server + sync agent)
4. **Синхронизация**: Изменения автоматически отправляются в облако
5. **Деплой**: Автоматический деплой на Netlify

## 🚀 Запуск

```bash
# Установка зависимостей
pnpm install

# Копирование конфигурации
cp env.example .env.local

# Запуск всех сервисов
pnpm run dev:all
```

После запуска:

- Веб-интерфейс: http://localhost:3004
- WebSocket сервер: ws://localhost:8080

## 📦 Пакеты

### `phion` (dev-agent)

npm пакет для синхронизации файлов между локальным проектом и облаком.

**Установка:**

```bash
pnpm add phion
```

**Использование:**

```bash
phion  # читает phion.config.json
```

**Конфигурация `phion.config.json`:**

```json
{
  "projectId": "uuid-проекта",
  "wsUrl": "ws://localhost:8080", // локально
  "debug": false
}
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License
