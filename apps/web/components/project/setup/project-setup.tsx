"use client"

import { Spinner } from "@/components/geist/spinner"
import { useToast } from "@/hooks/use-toast"
import { useWebSocket } from "@/hooks/use-websocket"
import type { ProjectRow } from "@shipvibes/database"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
// Material удален - не используется
import {
  DownloadStep,
  ProjectSetupLayout,
  ProjectSetupSidebar,
  SetupStep,
  type SetupStep as ISetupStep,
} from "./index"

interface ProjectSetupProps {
  project: ProjectRow
  agentConnected?: boolean // Статус агента получаем извне
}

export function ProjectSetup({ project, agentConnected = false }: ProjectSetupProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentComplete, setDeploymentComplete] = useState(false)
  const [projectUrl, setProjectUrl] = useState<string | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const { error: showError, success: showSuccess } = useToast()

  // Состояния выполнения для каждого шага
  const [downloadCompleted, setDownloadCompleted] = useState(false)
  const [setupCompleted, setSetupCompleted] = useState(false)

  // Рефы для плавного скролла
  const downloadStepRef = useRef<HTMLDivElement>(null)
  const setupStepRef = useRef<HTMLDivElement>(null)

  const [steps, setSteps] = useState<ISetupStep[]>([
    { id: "download", title: "Project Initialization", status: "READY" },
    { id: "setup", title: "Open in Cursor", status: "QUEUED" },
  ])

  // WebSocket для отслеживания статуса проекта в реальном времени
  const { isConnected } = useWebSocket({
    projectId: project.id,
    onDeployStatusUpdate: (data) => {
      console.log("🚀 [ProjectSetup] Deploy status update:", data)
      if (data.projectId === project.id) {
        // Обновляем статус шагов на основе WebSocket событий
        if (data.status === "pending") {
          // Проект инициализируется
          setSteps((prev) =>
            prev.map((step) => (step.id === "download" ? { ...step, status: "BUILDING" } : step)),
          )
        } else if (data.status === "ready" && !data.url) {
          // Инициализация завершена, проект готов к скачиванию
          setSteps((prev) =>
            prev.map((step) => (step.id === "download" ? { ...step, status: "READY" } : step)),
          )
        } else if (data.status === "building") {
          // Деплой в процессе - фоновая обработка
          setIsDeploying(true)
        } else if (data.status === "ready" && data.url) {
          // Деплой завершен успешно
          setIsDeploying(false)
          setDeploymentComplete(true)
          setProjectUrl(data.url)
        } else if (data.status === "failed") {
          // Деплой провалился
          setIsDeploying(false)
        }
      }
    },
    onFileTracked: () => {
      // Когда отслеживается новый файл
      console.log("📝 [ProjectSetup] File tracked")
    },
    onSaveSuccess: () => {
      // Когда файлы сохранены
      console.log("💾 [ProjectSetup] Save success")
    },
  })

  // Проверяем статус проекта при загрузке компонента
  useEffect(() => {
    const checkProjectStatus = async () => {
      try {
        const response = await fetch(`/api/projects/${project.id}/status`)
        if (response.ok) {
          const statusData = await response.json()

          // ИСПРАВЛЕНО: Проверяем статус деплоя и наличие Netlify URL
          if (statusData.deploy_status === "ready" && statusData.netlify_url) {
            // Проект полностью задеплоен - фоновая обработка
            setDeploymentComplete(true)
            setProjectUrl(statusData.netlify_url)
          }
          // Если статус ready но нет netlify_url - проект готов к скачиванию
          else if (statusData.deploy_status === "ready" && !statusData.netlify_url) {
            // Проект готов к скачиванию - разблокируем первый шаг
            setSteps((prev) =>
              prev.map((step) => (step.id === "download" ? { ...step, status: "READY" } : step)),
            )
          }
          // Если проект в процессе деплоя
          else if (statusData.deploy_status === "building") {
            setIsDeploying(true)
          }
          // Если проект инициализируется (загружаются файлы шаблона)
          else if (statusData.deploy_status === "pending") {
            // Показываем что проект еще инициализируется
            setSteps((prev) =>
              prev.map((step) => (step.id === "download" ? { ...step, status: "BUILDING" } : step)),
            )
          }

          // Определяем какой шаг должен быть активным
          if (!downloadCompleted) {
            setCurrentStep(0) // Первый шаг - скачивание
          } else if (!setupCompleted) {
            setCurrentStep(1) // Второй шаг - настройка
          }
        }
      } catch (error) {
        console.error("Error checking project status:", error)
      } finally {
        setIsLoadingStatus(false)
      }
    }

    checkProjectStatus()
  }, [project.id])

  // Обработчик завершения инициализации
  const handleInitializationComplete = useCallback(() => {
    console.log("✅ [ProjectSetup] Initialization completed")
    setSteps((prev) =>
      prev.map((step) => (step.id === "download" ? { ...step, status: "READY" } : step)),
    )
  }, [])

  // Функция плавного скролла к следующему шагу
  const scrollToStep = (stepIndex: number) => {
    const refs = [downloadStepRef, setupStepRef]
    const targetRef = refs[stepIndex]

    if (targetRef.current) {
      setTimeout(() => {
        targetRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }, 500) // Небольшая задержка чтобы UI успел обновиться
    }
  }

  const handleDownload = async () => {
    try {
      // Отмечаем первый шаг как выполненный
      setDownloadCompleted(true)
      showSuccess(
        "Project ready",
        "Run the commands below to download and set up your project locally",
      )

      // Update steps
      setSteps((prev) =>
        prev.map((step) =>
          step.id === "download"
            ? { ...step, status: "READY" }
            : step.id === "setup"
              ? { ...step, status: "READY" }
              : step,
        ),
      )
      setCurrentStep(1)

      // Скроллим к следующему шагу
      scrollToStep(1)
    } catch (error) {
      console.error("Error in download step:", error)
      setSteps((prev) =>
        prev.map((step) => (step.id === "download" ? { ...step, status: "ERROR" } : step)),
      )
      // Показываем ошибку пользователю
      showError("Project initialization failed", "Please try again")
    }
  }

  const handleSetupComplete = () => {
    setSetupCompleted(true)
    setSteps((prev) =>
      prev.map((step) => (step.id === "setup" ? { ...step, status: "READY" } : step)),
    )

    // Редиректим на overview по кнопке
    console.log("✅ [ProjectSetup] Setup completed, redirecting to overview...")
    router.push(`/project/${project.id}/overview`)
  }

  // Функция для возврата к шагу
  const handleStepClick = (stepIndex: number) => {
    // Можно вернуться к любому доступному шагу
    const canGoToStep =
      stepIndex === 0 || // Всегда можно вернуться к первому шагу
      (stepIndex === 1 && downloadCompleted) || // Можно перейти ко второму шагу если первый завершен
      stepIndex === currentStep // Можно остаться на текущем шаге

    if (canGoToStep) {
      setCurrentStep(stepIndex)
      scrollToStep(stepIndex)
    }
  }

  // Показываем загрузку пока проверяем статус
  if (isLoadingStatus) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="flex flex-col items-center justify-center text-center">
          <Spinner size={32} />
          <p className="mt-4 text-sm text-muted-foreground">Checking project status...</p>
        </div>
      </div>
    )
  }

  // Убираем показ congratulations page так как deploy step больше нет в UI
  // Редирект произойдет автоматически в onboarding/page.tsx при подключении агента

  return (
    <ProjectSetupLayout>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 lg:sticky lg:top-8 lg:self-start">
          <ProjectSetupSidebar
            steps={steps}
            currentStep={currentStep}
            project={project}
            downloadCompleted={downloadCompleted}
            setupCompleted={setupCompleted}
            deployCompleted={false} // Всегда false так как deploy step убран
            onStepClick={handleStepClick}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6 p-6 pb-[70vh]">
          {/* Steps Content */}
          <div className="space-y-6">
            <div
              ref={downloadStepRef}
              className={`transition-opacity ${
                currentStep === 0
                  ? "" // Текущий шаг - яркий
                  : downloadCompleted
                    ? "opacity-70" // Выполненный шаг - слегка затемнен но кликабелен
                    : "opacity-50 pointer-events-none" // Неактивный шаг - затемнен и некликабелен
              }`}
            >
              <DownloadStep
                project={project}
                projectId={project.id}
                onDownload={handleDownload}
                isCompleted={downloadCompleted}
                onInitializationComplete={handleInitializationComplete}
              />
            </div>

            <div
              ref={setupStepRef}
              className={`transition-opacity ${
                currentStep === 1
                  ? "" // Текущий шаг - яркий
                  : setupCompleted
                    ? "opacity-70" // Выполненный шаг - слегка затемнен но кликабелен
                    : currentStep > 1 || !downloadCompleted
                      ? "opacity-50 pointer-events-none" // Неактивный шаг - затемнен и некликабелен
                      : "opacity-50 pointer-events-none"
              }`}
            >
              <SetupStep
                onDeploy={handleSetupComplete}
                projectId={project.id}
                agentConnected={agentConnected}
              />
            </div>
          </div>
        </div>
      </div>
    </ProjectSetupLayout>
  )
}
