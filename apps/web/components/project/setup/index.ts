export { CongratulationsView } from "./congratulations-view"
export { ProjectSetupLayout } from "./setup-layout"
export { ProjectSetupSidebar } from "./setup-sidebar"

// Steps
// DownloadStep убран из онбординга - остается только шаг открытия проекта
export { SetupStep } from "./steps/setup-step"
// DeployStep убран из UI онбординга, но файл сохранен для возможного использования в других местах

// Types
export interface SetupStep {
  id: string
  title: string
  status: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CURRENT" | "COMPLETED"
}
