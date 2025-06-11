import { getSupabaseServerClient } from "./client";
import { ProjectQueries } from "./queries/projects";
import { FileHistoryQueries } from "./queries/file-history";
import { CommitHistoryQueries } from "./queries/commit-history";
// Создаем экземпляры классов запросов
const projectQueries = new ProjectQueries(getSupabaseServerClient());
const fileHistoryQueries = new FileHistoryQueries(getSupabaseServerClient());
const commitHistoryQueries = new CommitHistoryQueries(getSupabaseServerClient());
// Экспортируем удобные функции для проектов
export const getAllProjects = () => projectQueries.getAllProjects();
export const getUserProjects = (userId) => projectQueries.getUserProjects(userId);
export const getProjectById = (projectId) => projectQueries.getProjectById(projectId);
export const createProject = (projectData) => projectQueries.createProject(projectData);
export const updateProject = (projectId, updateData) => projectQueries.updateProject(projectId, updateData);
export const deleteProject = (projectId) => projectQueries.deleteProject(projectId);
export const updateDeployStatus = (projectId, status) => projectQueries.updateDeployStatus(projectId, status);
export const getProjectsByDeployStatus = (status) => projectQueries.getProjectsByDeployStatus(status);
// Экспортируем удобные функции для истории файлов
export const getProjectFileHistory = (projectId, limit, offset) => fileHistoryQueries.getProjectFileHistory(projectId, limit, offset);
export const getFileHistory = (projectId, filePath, limit) => fileHistoryQueries.getFileHistory(projectId, filePath, limit);
export const createFileHistory = (historyData) => fileHistoryQueries.createFileHistory(historyData);
export const getLatestFileVersion = (projectId, filePath) => fileHistoryQueries.getLatestFileVersion(projectId, filePath);
export const getFileHistoryById = (id) => fileHistoryQueries.getFileHistoryById(id);
export const getLatestFileVersions = (projectId) => fileHistoryQueries.getLatestFileVersions(projectId);
// Экспортируем классы для продвинутого использования
export { ProjectQueries, FileHistoryQueries } from "./queries";
// Import and initialize PendingChangesQueries
import { PendingChangesQueries } from "./queries/pending-changes";
const pendingChangesQueries = new PendingChangesQueries(getSupabaseServerClient());
// Export pending changes functions
export const getPendingChanges = (projectId) => pendingChangesQueries.getPendingChanges(projectId);
// GitHub функции для проектов
export const updateGitHubData = (projectId, githubData) => projectQueries.updateGitHubInfo(projectId, githubData);
export const getProjectsWithGitHub = () => projectQueries.getProjectsWithGitHub();
// Commit history функции
export const getProjectCommitHistory = (projectId, limit, offset) => commitHistoryQueries.getProjectCommitHistory(projectId, limit, offset);
export const createCommitHistory = (commitData) => commitHistoryQueries.createCommitHistory(commitData);
export const getCommitBySha = (projectId, githubCommitSha) => commitHistoryQueries.getCommitBySha(projectId, githubCommitSha);
export const getLatestCommit = (projectId) => commitHistoryQueries.getLatestCommit(projectId);
// GitHub функции для file history
export const createFileHistoryWithGitHub = (historyData) => fileHistoryQueries.createFileHistoryWithGitHub(historyData);
export const getFilesByGitHubCommit = (projectId, githubCommitSha) => fileHistoryQueries.getFilesByGitHubCommit(projectId, githubCommitSha);
// Экспортируем новый класс для продвинутого использования
export { CommitHistoryQueries } from "./queries";
