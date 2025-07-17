export { CongratulationsView } from "./congratulations-view"
export { ProjectSetupLayout } from "./setup-layout"
export { ProjectSetupSidebar } from "./setup-sidebar"

// Steps
// DownloadStep removed from onboarding - only project opening step remains
export { SetupStep } from "./steps/setup-step"
// DeployStep removed from onboarding UI, but file saved for possible use elsewhere

// Types
export interface SetupStep {
  id: string
  title: string
  status: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CURRENT" | "COMPLETED"
}
