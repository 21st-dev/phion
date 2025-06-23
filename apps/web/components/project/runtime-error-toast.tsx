"use client"

import React, { useEffect } from "react"
import { toast } from "sonner"
import { AlertTriangle, X } from "lucide-react"

interface RuntimeError {
  errorId: string
  projectId: string
  timestamp: number
  error: {
    message: string
    source?: string
    fileName?: string
    lineNumber?: number
  }
  context: {
    url: string
    toolbarVersion?: string
  }
}

interface RuntimeErrorToastProps {
  onRuntimeError?: (error: RuntimeError) => void
  showToasts?: boolean
}

export const RuntimeErrorToast: React.FC<RuntimeErrorToastProps> = ({
  onRuntimeError,
  showToasts = true,
}) => {
  useEffect(() => {
    // Подписываемся на WebSocket события runtime ошибок
    const handleRuntimeError = (error: RuntimeError) => {
      console.error("[Runtime Error]", error)

      // Вызываем callback если есть
      onRuntimeError?.(error)

      // Показываем toast уведомление
      if (showToasts) {
        toast.error(
          <div className="flex items-start gap-3 w-full">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-medium text-sm">Runtime Error in Toolbar</div>
              <div className="text-xs text-muted-foreground">{error.error.message}</div>
              {error.error.fileName && (
                <div className="text-xs text-muted-foreground">
                  {error.error.fileName}
                  {error.error.lineNumber && `:${error.error.lineNumber}`}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {new Date(error.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>,
          {
            duration: 8000,
            action: {
              label: "Dismiss",
              onClick: () => toast.dismiss(),
            },
          },
        )
      }
    }

    // В реальном приложении здесь будет подписка на WebSocket события
    // Пока что это заглушка для демонстрации интерфейса
    if (typeof window !== "undefined") {
      window.addEventListener("runtime_error", handleRuntimeError as any)

      return () => {
        window.removeEventListener("runtime_error", handleRuntimeError as any)
      }
    }
  }, [onRuntimeError, showToasts])

  return null
}
