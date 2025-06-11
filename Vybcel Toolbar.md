# Vybcel Toolbar & VS Code Integration TODO

## 🎯 Overview
Добавить встроенную шапку с кнопками Save/Discard/Preview в локальное превью + автоматическое открытие во вкладке VS Code.

---

## 📋 Phase 1: Vite Plugin для инжекта Toolbar

### 1.1 Создать Vite Plugin
- [ ] Создать `packages/vite-plugin-vybcel/`
- [ ] Настроить `package.json` с зависимостями:
  - `vite`, `rollup`, `socket.io-client`
- [ ] Создать основной файл `src/index.ts`:
  ```typescript
  export function vybcelPlugin(options: VybcelPluginOptions): Plugin
  ```
- [ ] Plugin должен:
  - Читать `vybcel.config.json` для получения `projectId` и `toolbar` флага
  - Инжектить `<script>` тег в `index.html` только если `toolbar: true`
  - Добавлять endpoint `/vybcel/toolbar.js` для раздачи toolbar bundle

### 1.2 Создать Toolbar компонент
- [ ] Создать `packages/vite-plugin-vybcel/src/toolbar/`
- [ ] Компоненты:
  - [ ] `Toolbar.tsx` - основной компонент с кнопками
  - [ ] `WebSocketClient.ts` - подключение к серверу 8080
  - [ ] `styles.css` - scoped стили с префиксом `vybcel-`
- [ ] Функционал кнопок:
  - [ ] **Save** - `emit('save_all_changes')`
  - [ ] **Discard** - `emit('discard_all_changes')`  
  - [ ] **Preview** - открыть `netlify_url` в новой вкладке
- [ ] Индикаторы состояния:
  - [ ] Счетчик pending changes
  - [ ] Статус деплоя (building/ready/failed)
  - [ ] Статус подключения агента

### 1.3 Сборка Toolbar bundle
- [ ] Настроить отдельную сборку для `toolbar.js`:
  - Rollup/Vite config для standalone bundle
  - Минификация и tree-shaking
  - Встроенные стили (no external CSS)
- [ ] Bundle должен быть self-contained (все зависимости внутри)

---

## 📋 Phase 2: Автоматическое открытие в VS Code

### 2.1 Детекция VS Code
- [ ] В локальном агенте добавить функцию `detectVSCode()`:
  - Проверить `process.env.VSCODE_PID`
  - Проверить `process.env.TERM_PROGRAM === 'vscode'`
  - Fallback: проверить наличие `code` команды в PATH

### 2.2 Открытие Simple Browser
- [ ] Добавить функцию `openInVSCode(url: string)`:
  ```typescript
  exec(`code --command "simpleBrowser.show" --command-args "${url}"`)
  ```
- [ ] Альтернативный метод через `vscode://` URI:
  ```typescript
  exec(`code --open-url "vscode://ms-vscode.vscode-simple-browser/show?url=${encodeURIComponent(url)}"`)
  ```

### 2.3 Интеграция в агент
- [ ] В `packages/dev-agent/src/index.ts` добавить:
  - [ ] Ожидание запуска dev-сервера (проверка `http://localhost:5173`)
  - [ ] Вызов `openInVSCode()` после успешного подключения к WebSocket
  - [ ] Логика предотвращения повторного открытия

---

## 📋 Phase 3: Конфигурация и опциональность

### 3.1 Расширить vybcel.config.json
- [ ] Добавить новые поля:
  ```json
  {
    "projectId": "abc123",
    "toolbar": {
      "enabled": true,
      "position": "top",
      "autoOpen": true
    }
  }
  ```

### 3.2 Обновить шаблон проекта
- [ ] В `templates/vite-react/vite.config.ts` добавить:
  ```typescript
  import { vybcelPlugin } from '@vybcel/vite-plugin'
  
  export default defineConfig({
    plugins: [react(), vybcelPlugin()]
  })
  ```
- [ ] Обновить `package.json` с зависимостью на plugin

### 3.3 Environment переменные
- [ ] Агент устанавливает `VYBCEL_TOOLBAR=true/false`
- [ ] Plugin читает переменную и конфиг для принятия решения

---

## 📋 Phase 4: WebSocket интеграция

### 4.1 Расширить WebSocket события
- [ ] В `apps/websocket-server/` добавить обработку:
  - [ ] `toolbar_get_status` - получить текущий статус проекта
  - [ ] `toolbar_save_all` - алиас для `save_all_changes`
  - [ ] `toolbar_discard_all` - алиас для `discard_all_changes`

### 4.2 Клиентская библиотека для Toolbar
- [ ] Создать `packages/vite-plugin-vybcel/src/websocket-client.ts`:
  - Подключение к `ws://localhost:8080`
  - Аутентификация с `projectId`
  - Подписка на события: `file_change_staged`, `commit_created`, `deploy_status_update`
  - Методы: `saveAll()`, `discardAll()`, `getStatus()`

---

## 📋 Phase 5: UI/UX и стилизация

### 5.1 Дизайн Toolbar
- [ ] Фиксированная позиция: `position: fixed; top: 0; z-index: 9999`
- [ ] Минималистичный дизайн в стиле shadcn/ui
- [ ] Адаптивность (скрытие на мобильных)
- [ ] Анимации для состояний (loading, success, error)

### 5.2 Предотвращение конфликтов
- [ ] Все CSS классы с префиксом `vybcel-`
- [ ] CSS reset для toolbar контейнера
- [ ] Проверка на конфликты с популярными CSS фреймворками

### 5.3 Горячие клавиши
- [ ] `Ctrl/Cmd + Shift + S` - Save All
- [ ] `Ctrl/Cmd + Shift + D` - Discard All
- [ ] `Ctrl/Cmd + Shift + P` - Open Preview

---

## 📋 Phase 6: Тестирование и документация

### 6.1 Тестирование
- [ ] Unit тесты для Vite plugin
- [ ] E2E тесты с Playwright:
  - Проверка инжекта toolbar
  - Функциональность кнопок
  - WebSocket подключение
- [ ] Тестирование на разных ОС (Windows, macOS, Linux)

### 6.2 Документация
- [ ] Обновить README с описанием новых возможностей
- [ ] Добавить секцию "Configuration" с примерами
- [ ] Создать troubleshooting guide
- [ ] Документировать API для разработчиков

### 6.3 Обратная совместимость
- [ ] Убедиться что существующие проекты работают без изменений
- [ ] Миграционный скрипт для обновления конфигов
- [ ] Fallback для проектов без toolbar

---

## 🚀 Deployment & Release

### 7.1 Публикация пакетов
- [ ] Опубликовать `@vybcel/vite-plugin` в npm
- [ ] Обновить зависимости в основном проекте
- [ ] Версионирование и changelog

### 7.2 Обновление шаблонов
- [ ] Обновить `templates/vite-react/` с новым plugin
- [ ] Тестирование создания новых проектов
- [ ] Обновление существующих проектов через migration

---

## ⏱️ Временные оценки

- **Phase 1-2**: 3-4 дня (основная функциональность)
- **Phase 3-4**: 2 дня (конфигурация и WebSocket)
- **Phase 5**: 2-3 дня (UI/UX полировка)
- **Phase 6**: 2 дня (тестирование и документация)
- **Phase 7**: 1 день (деплой и релиз)

**Итого: 10-12 дней**

---

## 🎯 Success Criteria

- [ ] Toolbar автоматически появляется в локальном превью
- [ ] VS Code автоматически открывает превью во вкладке
- [ ] Все кнопки работают и синхронизируются с веб-интерфейсом
- [ ] Можно отключить функционал через конфиг
- [ ] Нет конфликтов с пользовательским кодом
- [ ] Работает на всех основных ОС