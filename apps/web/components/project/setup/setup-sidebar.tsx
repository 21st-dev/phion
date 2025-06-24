"use client"

import { StatusDot } from "@/components/geist/status-dot"
import type { ProjectRow } from "@shipvibes/database"

interface SetupStep {
  id: string
  title: string
  status: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CURRENT" | "COMPLETED"
}

interface ProjectSetupSidebarProps {
  steps: SetupStep[]
  currentStep: number
  project: ProjectRow
  downloadCompleted?: boolean
  setupCompleted?: boolean
  deployCompleted?: boolean
  onStepClick?: (stepIndex: number) => void
}

export function ProjectSetupSidebar({
  steps,
  currentStep,
  project,
  downloadCompleted = false,
  setupCompleted = false,
  deployCompleted = false,
  onStepClick,
}: ProjectSetupSidebarProps) {
  // Функция для определения правильного статуса шага
  const getStepStatus = (stepIndex: number, step: SetupStep) => {
    // Проверяем выполненность по индексу шага (только 2 шага)
    const isCompleted =
      (stepIndex === 0 && downloadCompleted) || (stepIndex === 1 && setupCompleted)

    if (isCompleted) {
      return "READY" // Выполненные шаги - зеленые
    } else if (stepIndex === currentStep) {
      // Текущий шаг - желтый, если не в процессе сборки или ошибки
      return step.status === "BUILDING" || step.status === "ERROR" ? step.status : "CURRENT"
    } else if (stepIndex < currentStep) {
      return "CURRENT" // Доступные но не завершенные шаги - желтые
    } else {
      return "QUEUED" // Будущие шаги - серые
    }
  }

  // Функция для определения кликабельности шага
  const isStepClickable = (stepIndex: number) => {
    return (
      (stepIndex === 0 && downloadCompleted) ||
      (stepIndex === 1 && setupCompleted) ||
      stepIndex === currentStep
    )
  }

  return (
    <div className="lg:col-span-1">
      <div className="space-y-4">
        {steps.map((step, index) => {
          const statusForDot = getStepStatus(index, step)
          const isCompleted = (index === 0 && downloadCompleted) || (index === 1 && setupCompleted)
          const clickable = isStepClickable(index)

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                currentStep === index ? "bg-accents-1" : ""
              } ${clickable ? "cursor-pointer hover:bg-accents-1" : "cursor-default"}`}
              onClick={() => {
                if (clickable && onStepClick) {
                  onStepClick(index)
                }
              }}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  index < currentStep
                    ? "bg-foreground text-background" // Завершенные шаги - стандартные цвета
                    : index === currentStep
                      ? step.status === "BUILDING"
                        ? "bg-blue-600 text-white"
                        : step.status === "ERROR"
                          ? "bg-red-600 text-white"
                          : "bg-foreground text-background" // Текущий шаг - стандартные цвета
                      : "bg-muted text-muted-foreground" // Будущие шаги - серый
                }`}
              >
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{step.title}</div>
              </div>
              <StatusDot state={statusForDot} />
            </div>
          )
        })}
      </div>

      {/* Template Info */}
      <div className="mt-8 p-4 border border-border rounded-lg">
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
          Project Template
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium">{project.template_type}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M8.75 0.75V0H7.25V0.75V2V2.75H8.75V2V0.75ZM11.182 3.75732L11.7123 3.22699L12.0659 2.87344L12.5962 2.34311L13.6569 3.40377L13.1265 3.9341L12.773 4.28765L12.2426 4.81798L11.182 3.75732ZM8 10.5C9.38071 10.5 10.5 9.38071 10.5 8C10.5 6.61929 9.38071 5.5 8 5.5C6.61929 5.5 5.5 6.61929 5.5 8C5.5 9.38071 6.61929 10.5 8 10.5ZM8 12C10.2091 12 12 10.2091 12 8C12 5.79086 10.2091 4 8 4C5.79086 4 4 5.79086 4 8C4 10.2091 5.79086 12 8 12ZM13.25 7.25H14H15.25H16V8.75H15.25H14H13.25V7.25ZM0.75 7.25H0V8.75H0.75H2H2.75V7.25H2H0.75ZM2.87348 12.0659L2.34315 12.5962L3.40381 13.6569L3.93414 13.1265L4.28769 12.773L4.81802 12.2426L3.75736 11.182L3.22703 11.7123L2.87348 12.0659ZM3.75735 4.81798L3.22702 4.28765L2.87347 3.9341L2.34314 3.40377L3.4038 2.34311L3.93413 2.87344L4.28768 3.22699L4.81802 3.75732L3.75735 4.81798ZM12.0659 13.1265L12.5962 13.6569L13.6569 12.5962L13.1265 12.0659L12.773 11.7123L12.2426 11.182L11.182 12.2426L11.7123 12.773L12.0659 13.1265ZM8.75 13.25V14V15.25V16H7.25V15.25V14V13.25H8.75Z"
            />
          </svg>
          main
          <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
          {project.name}
        </div>
      </div>
    </div>
  )
}
