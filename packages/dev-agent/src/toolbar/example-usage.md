# Runtime Error Reporting

Система автоматического сбора и отправки runtime ошибок браузера на WebSocket сервер.

## Как это работает

1. **Автоматический перехват ошибок** - Toolbar автоматически перехватывает все runtime ошибки в браузере:

   - Синхронные JavaScript ошибки (`window.error`)
   - Необработанные Promise ошибки (`unhandledrejection`)
   - Ошибки загрузки ресурсов (изображения, скрипты, стили)

2. **Фильтрация ошибок** - Игнорируются неважные ошибки:

   - `Script error`
   - `ResizeObserver loop limit exceeded`
   - `Network request failed`
   - `Loading chunk` / `ChunkLoadError`

3. **Буферизация** - Если WebSocket не подключен, ошибки сохраняются в буфере (до 10 штук)

4. **Отправка на сервер** - Ошибки отправляются через WebSocket с полным контекстом

## Структура данных ошибки

```typescript
interface RuntimeErrorPayload {
  projectId: string
  clientType: "toolbar"
  timestamp: number
  url: string
  userAgent: string
  error: {
    message: string
    stack?: string
    fileName?: string
    lineNumber?: number
    columnNumber?: number
    source?: string // 'window.error' | 'unhandledrejection' | 'resource.error' | 'manual'
  }
  context: {
    toolbarVersion?: string
    browserInfo?: {
      language: string
      platform: string
      cookieEnabled: boolean
      onLine: boolean
    }
    pageInfo?: {
      title: string
      referrer: string
      pathname: string
    }
  }
}
```

## Логи на сервере

При получении ошибки сервер выводит подробную информацию:

```
🐛 [RUNTIME_ERROR] Project abc123_1640995200000_xyz789:
   Message: TypeError: Cannot read property 'foo' of undefined
   Source: window.error
   File: /src/App.tsx:42:15
   URL: http://localhost:5173/
   Toolbar: 0.1.0
   Browser: MacIntel en-US
   Time: 2023-12-31T23:59:59.000Z
   Stack:
     TypeError: Cannot read property 'foo' of undefined
         at App.tsx:42:15
         at handleClick (App.tsx:38:5)
```

## Ручная отправка ошибок

```typescript
// В коде toolbar можно вручную отправить ошибку
client.reportError(new Error("Custom error"), "user-action")
```

## Отключение системы

Система активируется автоматически при подключении toolbar к WebSocket серверу.
Для отключения можно добавить фильтр в `shouldIgnoreError()` метод.

## WebSocket события

- **Отправляемые события:**

  - `toolbar_runtime_error` - отправка ошибки на сервер

- **Получаемые события:**
  - `runtime_error_received` - подтверждение получения ошибки сервером
  - `runtime_error` - уведомление всех клиентов проекта об ошибке (для UI)
