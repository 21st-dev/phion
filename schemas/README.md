# 🚀 VYBCEL/SHIPVIBES - ДЕТАЛЬНЫЕ СХЕМЫ АРХИТЕКТУРЫ

Полная коллекция детальных схем архитектуры платформы редактирования фронтенд-кода с автодеплоем.

## 📊 Обзор схем

Каждая схема представляет собой Mermaid sequence diagram с детальным разбором конкретного компонента системы.

### 🌐 [01. Web App Architecture](./01_web_app_architecture.mmd)
**Next.js веб-приложение - порт 3004**

Детальная архитектура веб-интерфейса, включающая:
- 📁 Файловая структура приложения (app/, components/, lib/)
- 🔗 API Routes архитектура (/api/projects, /api/toolbar, /api/webhooks)
- 🔐 Система аутентификации (Supabase Auth интеграция)
- 🗄️ Управление состоянием (Context Providers, TanStack Query)
- 🎨 UI компоненты и дизайн-система (shadcn/ui)
- ⚡ Производительность и оптимизация (Server Components, кеширование)
- 🚀 Development & Deployment (Vercel, environment variables)

### 🔄 [02. WebSocket Server Architecture](./02_websocket_server_architecture.mmd)
**Express + Socket.IO сервер - порт 8080**

Архитектура real-time коммуникационного сервера:
- 📁 Структура сервера (services/, handlers/, utils/)
- 📡 Socket.IO архитектура (события, комнаты, соединения)
- 🏠 Комнаты и управление соединениями
- 🐙 GitHub Service интеграция (GitHub App, API операции)
- 🚀 Netlify Service интеграция (автодеплой, webhooks)
- 📁 Project Service (управление проектами, фоновые задачи)
- 🌐 HTTP API Endpoints (REST маршруты, middleware)
- 📊 Логирование и мониторинг
- 🚀 Deployment & Environment (Railway.app, переменные окружения)

### 📡 [03. Dev Agent Architecture](./03_dev_agent_architecture.mmd)
**Node.js локальный агент синхронизации**

Архитектура локального агента для файлового мониторинга:
- 📁 Структура агента (watcher/, websocket/, git/, config/)
- ⚙️ Инициализация и конфигурация (vybcel.config.json)
- 👁️ File Watcher система (chokidar, события файлов)
- 🔄 WebSocket Client (подключение, события, переподключение)
- 🌳 Git локальная интеграция (операции, синхронизация)
- 📄 Обработка и фильтрация файлов (типы изменений, валидация)
- 💻 CLI интерфейс и команды
- 📊 Мониторинг и диагностика
- ❌ Обработка ошибок и recovery

### 🛠️ [04. Toolbar System Architecture](./04_toolbar_system_architecture.mmd)
**Автообновляемый интерфейс**

Система автоматических обновлений toolbar:
- 📁 Структура toolbar системы (vite-plugin-vybcel/)
- ⚡ Vite Plugin интеграция (хуки, внедрение, HMR)
- 🎨 Toolbar UI компоненты (Container, StatusIndicator, ActionButtons)
- 🔄 Update Manager (автопроверка, скачивание, применение)
- 🔄 WebSocket интеграция (события toolbar)
- ☁️ R2 Storage для версий (структура хранилища, операции)
- 👨‍💼 Admin Interface (загрузка, управление каналами)
- 🔥 Hot Module Replacement
- ⚙️ Конфигурация и настройки
- ⚡ Производительность и оптимизация
- 🔒 Безопасность и валидация

### 🗃️ [05. Database Architecture](./05_database_architecture.mmd)
**Supabase PostgreSQL**

Детальная архитектура базы данных:
- 📊 Схема базы данных (таблицы, поля, индексы)
- 🛡️ Row Level Security (RLS политики, безопасность)
- 💾 Supabase Client интеграция (конфигурация, методы)
- 🔐 Supabase Authentication (JWT токены, жизненный цикл сессии)
- 📋 Query Layer и оптимизация (организация запросов)
- ⚡ Realtime Subscriptions (WebSocket, события)
- 🚀 Индексы и производительность
- 💾 Backup и disaster recovery
- 🔄 Database Migrations (система миграций)

### 🔗 [06. External Services Architecture](./06_external_services_architecture.mmd)
**GitHub, Netlify интеграция**

Архитектура внешних сервисов:
- 🤖 GitHub App архитектура (конфигурация, permissions, JWT)
- 📦 GitHub Repository операции (создание, файловые операции, Git)
- 🔔 GitHub Webhooks (события, payload)
- 🚀 Netlify API архитектура (конфигурация, endpoints)
- 🏗️ Netlify Build Process (конфигурация, шаги, environment)
- 🔔 Netlify Webhooks (события деплоя)
- 🌍 CDN и Edge Deployment (оптимизация, кеширование)
- ❌ Error Handling и мониторинг
- 🔒 Security и best practices
- 🔄 Integration Patterns (lifecycle, recovery patterns)

### ☁️ [07. Storage Architecture](./07_storage_architecture.mmd)
**Cloudflare R2**

Архитектура облачного хранилища:
- 🪣 R2 Bucket структура (toolbar-versions/, project-templates/, backups/)
- 💾 Storage Client архитектура (managers/, utils/, AWS S3 API)
- 🛠️ Toolbar Version Management (upload, download, channels)
- 📄 Template Management (операции, структура шаблонов)
- 💾 Backup Management (snapshots, incremental, cleanup)
- 🌍 Cloudflare CDN интеграция (кеширование, оптимизация)
- 👨‍💼 Администрирование и мониторинг
- 🔒 Безопасность и контроль доступа
- ⚡ Performance Optimization (multipart uploads, streaming)

## 📋 Полная схема архитектуры

### [Main Architecture Overview](../vybcel_architecture_detailed.mmd)
Общая схема со всеми компонентами и их взаимодействием.

## 🔍 Как использовать схемы

1. **Для понимания системы**: Начните с общей схемы, затем углубляйтесь в конкретные компоненты
2. **Для разработки**: Используйте схемы как reference при реализации функций
3. **Для онбординга**: Схемы помогают новым разработчикам быстро понять архитектуру
4. **Для документации**: Схемы служат живой документацией системы

## 🛠️ Технологический стек

### Frontend
- **Next.js 15** (App Router)
- **React 18** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **TanStack Query** (state management)

### Backend  
- **Node.js** + **Express** + **Socket.IO**
- **Supabase** (PostgreSQL + Auth + Realtime)
- **Cloudflare R2** (object storage)

### External Services
- **GitHub App** (repository management)
- **Netlify** (auto-deploy + CDN)

### DevOps
- **Turbo.build** (monorepo)
- **pnpm** (package manager)
- **Railway.app** (WebSocket server hosting)
- **Vercel** (web app hosting)

## 📊 Метрики и статистика

- **7 детальных схем** компонентов
- **200+ sequence diagram элементов**
- **50+ технических блоков** с описаниями
- **Полное покрытие** всех аспектов системы

## 🔄 Обновления схем

Схемы обновляются при:
- Добавлении новых компонентов
- Изменении архитектурных решений  
- Оптимизации существующих решений
- Добавлении новых интеграций

---

**Создано для проекта Vybcel/Shipvibes** 🚀