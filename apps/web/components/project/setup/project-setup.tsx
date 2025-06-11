"use client";

import { useState, useRef, useEffect } from "react";
import type { DatabaseTypes } from "@shipvibes/database";
// Material удален - не используется
import {
  ProjectSetupLayout,
  ProjectSetupSidebar,
  CongratulationsView,
  DownloadStep,
  SetupStep,
  DeployStep,
  type SetupStep as ISetupStep,
} from "./index";

interface ProjectSetupProps {
  project: DatabaseTypes.ProjectRow;
  agentConnected?: boolean; // Статус агента получаем извне
}

export function ProjectSetup({
  project,
  agentConnected = false,
}: ProjectSetupProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [projectUrl, setProjectUrl] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Состояния выполнения для каждого шага
  const [downloadCompleted, setDownloadCompleted] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [deployCompleted, setDeployCompleted] = useState(false);

  // Рефы для плавного скролла
  const downloadStepRef = useRef<HTMLDivElement>(null);
  const setupStepRef = useRef<HTMLDivElement>(null);
  const deployStepRef = useRef<HTMLDivElement>(null);

  const [steps, setSteps] = useState<ISetupStep[]>([
    { id: "download", title: "Get Files", status: "READY" },
    { id: "setup", title: "Open in Cursor", status: "QUEUED" },
    { id: "deploy", title: "Go Live", status: "QUEUED" },
  ]);

  // Проверяем статус проекта при загрузке компонента
  useEffect(() => {
    const checkProjectStatus = async () => {
      try {
        const response = await fetch(`/api/projects/${project.id}/status`);
        if (response.ok) {
          const statusData = await response.json();

          // ИСПРАВЛЕНО: Проверяем только статус деплоя, не делаем предположений о других шагах
          if (statusData.deploy_status === "ready" && statusData.netlify_url) {
            // Только последний шаг - деплой - отмечаем как готовый
            setDeploymentComplete(true);
            setProjectUrl(statusData.netlify_url);
            setDeployCompleted(true);

            // НЕ устанавливаем downloadCompleted и setupCompleted автоматически
            // Пользователь должен пройти эти шаги самостоятельно

            setSteps((prev) =>
              prev.map((step) =>
                step.id === "deploy" ? { ...step, status: "READY" } : step
              )
            );
          }
          // Если проект в процессе деплоя
          else if (statusData.deploy_status === "building") {
            setIsDeploying(true);

            // НЕ отмечаем предыдущие шаги как выполненные автоматически
            setSteps((prev) =>
              prev.map((step) =>
                step.id === "deploy" ? { ...step, status: "BUILDING" } : step
              )
            );

            // Начинаем мониторинг деплоя
            startDeployStatusMonitoring();
          }
          // Если проект инициализируется (загружаются файлы шаблона)
          else if (statusData.deploy_status === "pending") {
            // Показываем что проект еще инициализируется
            setSteps((prev) =>
              prev.map((step) =>
                step.id === "download" ? { ...step, status: "BUILDING" } : step
              )
            );

            // Запускаем проверку завершения инициализации
            startInitializationMonitoring();
          }

          // НОВАЯ ЛОГИКА: Определяем текущий шаг на основе реального состояния
          // Определяем какой шаг должен быть активным
          if (!downloadCompleted) {
            setCurrentStep(0); // Первый шаг - скачивание
          } else if (!setupCompleted) {
            setCurrentStep(1); // Второй шаг - настройка
          } else if (!deployCompleted && statusData.deploy_status !== "ready") {
            setCurrentStep(2); // Третий шаг - деплой (только если еще не готов)
          } else if (deployCompleted || statusData.deploy_status === "ready") {
            setCurrentStep(2); // Остаемся на последнем шаге если всё готово
          }
        }
      } catch (error) {
        console.error("Error checking project status:", error);
      } finally {
        setIsLoadingStatus(false);
      }
    };

    checkProjectStatus();
  }, [project.id]);

  // Функция для мониторинга инициализации проекта
  const startInitializationMonitoring = () => {
    const checkInitializationStatus = async () => {
      try {
        const statusResponse = await fetch(
          `/api/projects/${project.id}/status`
        );
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();

          // Если инициализация завершена (статус больше не "pending")
          if (statusData.deploy_status !== "pending") {
            setSteps((prev) =>
              prev.map((step) =>
                step.id === "download" ? { ...step, status: "READY" } : step
              )
            );
            console.log("✅ Project initialization completed!");
          }
          // Если инициализация еще в процессе, проверяем снова через 2 секунды
          else if (statusData.deploy_status === "pending") {
            setTimeout(checkInitializationStatus, 2000);
          }
        }
      } catch (error) {
        console.error("Error checking initialization status:", error);
        setSteps((prev) =>
          prev.map((step) =>
            step.id === "download" ? { ...step, status: "ERROR" } : step
          )
        );
      }
    };

    // Начинаем проверку статуса через 2 секунды
    setTimeout(checkInitializationStatus, 2000);
  };

  // Функция для мониторинга статуса деплоя
  const startDeployStatusMonitoring = () => {
    const checkDeployStatus = async () => {
      try {
        const statusResponse = await fetch(
          `/api/projects/${project.id}/status`
        );
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();

          // Если деплой завершен успешно
          if (statusData.deploy_status === "ready" && statusData.netlify_url) {
            setSteps((prev) =>
              prev.map((step) =>
                step.id === "deploy" ? { ...step, status: "READY" } : step
              )
            );
            setIsDeploying(false);
            setDeploymentComplete(true);
            setDeployCompleted(true);
            setProjectUrl(statusData.netlify_url);
            setCurrentStep(2);
          }
          // Если деплой еще в процессе, проверяем снова через 2 секунды
          else if (statusData.deploy_status === "building") {
            setTimeout(checkDeployStatus, 2000);
          }
          // Если деплой провалился
          else if (statusData.deploy_status === "failed") {
            throw new Error("Deployment failed");
          }
        }
      } catch (error) {
        console.error("Error checking deploy status:", error);
        setSteps((prev) =>
          prev.map((step) =>
            step.id === "deploy" ? { ...step, status: "ERROR" } : step
          )
        );
        setIsDeploying(false);
      }
    };

    // Начинаем проверку статуса через 3 секунды
    setTimeout(checkDeployStatus, 3000);
  };

  // Функция плавного скролла к следующему шагу
  const scrollToStep = (stepIndex: number) => {
    const refs = [downloadStepRef, setupStepRef, deployStepRef];
    const targetRef = refs[stepIndex];

    if (targetRef.current) {
      setTimeout(() => {
        targetRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 500); // Небольшая задержка чтобы UI успел обновиться
    }
  };

  const handleDownload = async () => {
    // Проверяем актуальный статус проекта перед скачиванием
    try {
      const statusResponse = await fetch(`/api/projects/${project.id}/status`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.deploy_status === "pending") {
          alert(
            "Project is still initializing. Please wait for initialization to complete."
          );
          return;
        }
      }
    } catch (error) {
      console.error("Error checking project status:", error);
    }

    try {
      const response = await fetch(`/api/projects/${project.id}/download`);
      if (!response.ok) {
        throw new Error("Failed to download project");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Отмечаем первый шаг как выполненный
      setDownloadCompleted(true);

      // Update steps
      setSteps((prev) =>
        prev.map((step) =>
          step.id === "download"
            ? { ...step, status: "READY" }
            : step.id === "setup"
            ? { ...step, status: "READY" }
            : step
        )
      );
      setCurrentStep(1);

      // Скроллим к следующему шагу
      scrollToStep(1);
    } catch (error) {
      console.error("Error downloading project:", error);
      setSteps((prev) =>
        prev.map((step) =>
          step.id === "download" ? { ...step, status: "ERROR" } : step
        )
      );
      // Показываем ошибку пользователю
      alert("Failed to download project. Please try again.");
    }
  };

  const handleSetupComplete = () => {
    setSetupCompleted(true);
    setSteps((prev) =>
      prev.map((step) =>
        step.id === "setup"
          ? { ...step, status: "READY" }
          : step.id === "deploy"
          ? { ...step, status: "READY" }
          : step
      )
    );
    setCurrentStep(2);

    // Скроллим к следующему шагу
    scrollToStep(2);
  };

  const handleDeploy = async () => {
    // Проверяем что проект еще не задеплоен
    const statusResponse = await fetch(`/api/projects/${project.id}/status`);
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      if (statusData.deploy_status === "ready") {
        // Проект уже задеплоен, не нужно деплоить снова
        setDeploymentComplete(true);
        setProjectUrl(statusData.netlify_url);
        return;
      }
    }

    setIsDeploying(true);
    setSteps((prev) =>
      prev.map((step) =>
        step.id === "deploy" ? { ...step, status: "BUILDING" } : step
      )
    );

    try {
      const response = await fetch(`/api/projects/${project.id}/deploy`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Publishing failed");
      }

      const data = await response.json();

      // Начинаем мониторинг деплоя
      startDeployStatusMonitoring();
    } catch (error) {
      console.error("Publishing error:", error);
      setSteps((prev) =>
        prev.map((step) =>
          step.id === "deploy" ? { ...step, status: "ERROR" } : step
        )
      );
      setIsDeploying(false);
    }
  };

  // Функция для возврата к шагу
  const handleStepClick = (stepIndex: number) => {
    // Можно вернуться только к выполненным шагам или текущему
    const canGoToStep =
      (stepIndex === 0 && downloadCompleted) ||
      (stepIndex === 1 && setupCompleted) ||
      (stepIndex === 2 && deployCompleted) ||
      stepIndex === currentStep;

    if (canGoToStep) {
      setCurrentStep(stepIndex);
      scrollToStep(stepIndex);
    }
  };

  // Показываем загрузку пока проверяем статус
  if (isLoadingStatus) {
    return (
      <ProjectSetupLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">
              Checking project status...
            </p>
          </div>
        </div>
      </ProjectSetupLayout>
    );
  }

  // Show congratulations page only if deployment is complete AND user completed all steps
  if (
    deploymentComplete &&
    projectUrl &&
    downloadCompleted &&
    setupCompleted &&
    deployCompleted
  ) {
    return <CongratulationsView projectUrl={projectUrl} />;
  }

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
            deployCompleted={deployCompleted}
            onStepClick={handleStepClick}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6 pb-[70vh]">
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
                onDownload={handleDownload}
                isCompleted={downloadCompleted}
                isInitializing={project.deploy_status === "pending"}
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
              <SetupStep onDeploy={handleSetupComplete} />
              {setupCompleted && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                  Setup completed successfully!
                </div>
              )}
            </div>

            <div
              ref={deployStepRef}
              className={`transition-opacity ${
                currentStep === 2
                  ? "" // Текущий шаг - яркий
                  : deployCompleted
                  ? "opacity-70" // Выполненный шаг - слегка затемнен но кликабелен
                  : "opacity-50 pointer-events-none" // Неактивный шаг - затемнен и некликабелен
              }`}
            >
              <DeployStep
                projectId={project.id}
                isDeploying={isDeploying}
                onDeploy={handleDeploy}
                agentConnected={agentConnected}
              />
              {deployCompleted && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                  Published successfully!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProjectSetupLayout>
  );
}
