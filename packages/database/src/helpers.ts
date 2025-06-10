import { getSupabaseServerClient } from "./client";
import { ProjectQueries } from "./queries/projects";
import { FileHistoryQueries } from "./queries/file-history";
import { CreateProject, UpdateProject, CreateFileHistory } from "@shipvibes/shared";
import { ProjectRow, FileHistoryRow } from "./types";

// Создаем экземпляры классов запросов
const projectQueries = new ProjectQueries(getSupabaseServerClient());
const fileHistoryQueries = new FileHistoryQueries(getSupabaseServerClient());

// Экспортируем удобные функции для проектов
export const getAllProjects = (): Promise<ProjectRow[]> => 
  projectQueries.getAllProjects();

export const getUserProjects = (userId?: string): Promise<ProjectRow[]> => 
  projectQueries.getUserProjects(userId);

export const getProjectById = (projectId: string): Promise<ProjectRow | null> => 
  projectQueries.getProjectById(projectId);

export const createProject = (projectData: CreateProject & { user_id?: string }): Promise<ProjectRow> => 
  projectQueries.createProject(projectData);

export const updateProject = (projectId: string, updateData: UpdateProject): Promise<ProjectRow> => 
  projectQueries.updateProject(projectId, updateData);

export const deleteProject = (projectId: string): Promise<void> => 
  projectQueries.deleteProject(projectId);

export const updateDeployStatus = (
  projectId: string,
  status: "pending" | "building" | "ready" | "failed" | "cancelled",
  netlifyUrl?: string,
  netlifyId?: string
): Promise<ProjectRow> => 
  projectQueries.updateDeployStatus(projectId, status, netlifyUrl, netlifyId);

export const getProjectsByDeployStatus = (
  status: "pending" | "building" | "ready" | "failed" | "cancelled"
): Promise<ProjectRow[]> => 
  projectQueries.getProjectsByDeployStatus(status);

export const searchProjects = (searchTerm: string): Promise<ProjectRow[]> => 
  projectQueries.searchProjects(searchTerm);

export const searchUserProjects = (searchTerm: string, userId?: string): Promise<ProjectRow[]> => 
  projectQueries.searchUserProjects(searchTerm, userId);

// Экспортируем удобные функции для истории файлов
export const getProjectFileHistory = (projectId: string, limit?: number, offset?: number): Promise<FileHistoryRow[]> => 
  fileHistoryQueries.getProjectFileHistory(projectId, limit, offset);

export const getFileHistory = (projectId: string, filePath: string, limit?: number): Promise<FileHistoryRow[]> => 
  fileHistoryQueries.getFileHistory(projectId, filePath, limit);

export const createFileHistory = (historyData: CreateFileHistory): Promise<FileHistoryRow> => 
  fileHistoryQueries.createFileHistory(historyData);

export const getLatestFileVersion = (projectId: string, filePath: string): Promise<FileHistoryRow | null> => 
  fileHistoryQueries.getLatestFileVersion(projectId, filePath);

export const getFileHistoryById = (id: string): Promise<FileHistoryRow | null> => 
  fileHistoryQueries.getFileHistoryById(id);

export const getLatestFileVersions = (projectId: string): Promise<FileHistoryRow[]> => 
  fileHistoryQueries.getLatestFileVersions(projectId);

// Экспортируем классы для продвинутого использования
export { ProjectQueries, FileHistoryQueries } from "./queries";

// Import and initialize PendingChangesQueries
import { PendingChangesQueries } from "./queries/pending-changes";
const pendingChangesQueries = new PendingChangesQueries(getSupabaseServerClient());

// Export pending changes functions
export const getPendingChanges = (projectId: string) => 
  pendingChangesQueries.getPendingChanges(projectId);
