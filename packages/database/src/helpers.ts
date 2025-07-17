import { getSupabaseServerClient } from "./client"
import {
  ProjectQueries,
  FileHistoryQueries,
  CommitHistoryQueries,
  PendingChangesQueries,
} from "./queries"
import { CreateProject, UpdateProject, CreateFileHistory } from "@shipvibes/shared"
import { ProjectRow, FileHistoryRow, CommitHistoryRow } from "./types"

// Create instances of query classes
const projectQueries = new ProjectQueries(getSupabaseServerClient())
const fileHistoryQueries = new FileHistoryQueries(getSupabaseServerClient())
const commitHistoryQueries = new CommitHistoryQueries(getSupabaseServerClient())

// Export convenient functions for projects
export const getAllProjects = (): Promise<ProjectRow[]> => projectQueries.getAllProjects()

export const getUserProjects = (userId: string): Promise<ProjectRow[]> =>
  projectQueries.getUserProjects(userId)

export const getProjectById = (projectId: string): Promise<ProjectRow | null> =>
  projectQueries.getProjectById(projectId)

export const createProject = (
  projectData: CreateProject & { user_id: string },
): Promise<ProjectRow> => projectQueries.createProject(projectData)

export const updateProject = (projectId: string, updateData: UpdateProject): Promise<ProjectRow> =>
  projectQueries.updateProject(projectId, updateData)

export const deleteProject = (projectId: string): Promise<void> =>
  projectQueries.deleteProject(projectId)

export const updateDeployStatus = (
  projectId: string,
  status: "pending" | "building" | "ready" | "failed" | "cancelled",
): Promise<ProjectRow> => projectQueries.updateDeployStatus(projectId, status)

export const getProjectsByDeployStatus = (
  status: "pending" | "building" | "ready" | "failed" | "cancelled",
): Promise<ProjectRow[]> => projectQueries.getProjectsByDeployStatus(status)

// Export convenient functions for file history
export const getProjectFileHistory = (
  projectId: string,
  limit?: number,
  offset?: number,
): Promise<FileHistoryRow[]> => fileHistoryQueries.getProjectFileHistory(projectId, limit, offset)

export const getFileHistory = (
  projectId: string,
  filePath: string,
  limit?: number,
): Promise<FileHistoryRow[]> => fileHistoryQueries.getFileHistory(projectId, filePath, limit)

export const createFileHistory = (historyData: CreateFileHistory): Promise<FileHistoryRow> =>
  fileHistoryQueries.createFileHistory(historyData)

export const getLatestFileVersion = (
  projectId: string,
  filePath: string,
): Promise<FileHistoryRow | null> => fileHistoryQueries.getLatestFileVersion(projectId, filePath)

export const getFileHistoryById = (id: string): Promise<FileHistoryRow | null> =>
  fileHistoryQueries.getFileHistoryById(id)

export const getLatestFileVersions = (projectId: string): Promise<FileHistoryRow[]> =>
  fileHistoryQueries.getLatestFileVersions(projectId)

// Export classes for advanced usage
export { ProjectQueries, FileHistoryQueries } from "./queries"

// Import and initialize PendingChangesQueries
const pendingChangesQueries = new PendingChangesQueries(getSupabaseServerClient())

// Export pending changes functions
export const getPendingChanges = (projectId: string) =>
  pendingChangesQueries.getPendingChanges(projectId)

// GitHub functions for projects
export const updateGitHubData = (
  projectId: string,
  githubData: {
    github_repo_url?: string
    github_repo_name?: string
    github_owner?: string
  },
): Promise<ProjectRow> =>
  projectQueries.updateGitHubInfo(
    projectId,
    githubData as {
      github_repo_url: string
      github_repo_name: string
      github_owner?: string
    },
  )

export const getProjectsWithGitHub = (): Promise<ProjectRow[]> =>
  projectQueries.getProjectsWithGitHub()

// Commit history functions
export const getProjectCommitHistory = (
  projectId: string,
  limit?: number,
  offset?: number,
): Promise<CommitHistoryRow[]> =>
  commitHistoryQueries.getProjectCommitHistory(projectId, limit, offset)

export const createCommitHistory = (commitData: {
  project_id: string
  github_commit_sha: string
  github_commit_url: string
  commit_message: string
  files_count?: number
  committed_by?: string
}): Promise<CommitHistoryRow> => commitHistoryQueries.createCommitHistory(commitData)

export const getCommitBySha = (
  projectId: string,
  githubCommitSha: string,
): Promise<CommitHistoryRow | null> =>
  commitHistoryQueries.getCommitBySha(projectId, githubCommitSha)

export const getLatestCommit = (projectId: string): Promise<CommitHistoryRow | null> =>
  commitHistoryQueries.getLatestCommit(projectId)

// GitHub functions for file history
export const createFileHistoryWithGitHub = (
  historyData: CreateFileHistory & {
    github_commit_sha?: string
    github_commit_url?: string
  },
): Promise<FileHistoryRow> => fileHistoryQueries.createFileHistoryWithGitHub(historyData)

export const getFilesByGitHubCommit = (
  projectId: string,
  githubCommitSha: string,
): Promise<FileHistoryRow[]> =>
  fileHistoryQueries.getFilesByGitHubCommit(projectId, githubCommitSha)

// Export new class for advanced usage
export { CommitHistoryQueries } from "./queries"
