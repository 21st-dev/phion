export { ProjectSetupLayout } from './setup-layout';
export { ProjectSetupSidebar } from './setup-sidebar';
export { CongratulationsView } from './congratulations-view';

// Steps
export { DownloadStep } from './steps/download-step';
export { SetupStep } from './steps/setup-step';
export { DeployStep } from './steps/deploy-step';

// Types
export interface SetupStep {
  id: string;
  title: string;
  status: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CURRENT";
} 