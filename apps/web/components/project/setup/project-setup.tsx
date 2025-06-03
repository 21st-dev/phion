"use client";

import { useState, useRef, useEffect } from "react";
import type { ProjectRow } from "@shipvibes/database";
import { Material } from "@/components/geist/material";
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
  project: ProjectRow;
}

export function ProjectSetup({ project }: ProjectSetupProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [projectUrl, setProjectUrl] = useState<string | null>(null);

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

      // Simulate deployment process
      setTimeout(() => {
        setSteps((prev) =>
          prev.map((step) =>
            step.id === "deploy" ? { ...step, status: "READY" } : step
          )
        );
        setIsDeploying(false);
        setDeploymentComplete(true);
        setDeployCompleted(true);
        setProjectUrl(data.url || `https://${project.name}.netlify.app`);
        setCurrentStep(2);
      }, 3000);
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

  // Show congratulations page if deployment is complete
  if (deploymentComplete && projectUrl) {
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
