import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, CommitHistoryQueries, FileHistoryQueries } from "@shipvibes/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const commitId = searchParams.get('commit_id');
    
    const supabase = getSupabaseServerClient();
    
    if (commitId) {
      // Получить файлы конкретного коммита (save point)
      const fileHistoryQueries = new FileHistoryQueries(supabase);
      const files = await fileHistoryQueries.getFilesByGitHubCommit(projectId, commitId);
      return NextResponse.json({ files });
    } else {
      // Получить список коммитов проекта (save points)
      const commitHistoryQueries = new CommitHistoryQueries(supabase);
      const commits = await commitHistoryQueries.getProjectCommitHistory(projectId);
      
      // Преобразуем в формат, понятный для UI (скрываем GitHub детали)
      const savePoints = commits.map(commit => ({
        commit_id: commit.github_commit_sha, // Используем как ID для обратной совместимости
        commit_message: commit.commit_message,
        created_at: commit.created_at,
        project_id: commit.project_id,
        files_count: commit.files_count || 0
      }));
      
      return NextResponse.json({ commits: savePoints });
    }
  } catch (error) {
    console.error("Error fetching commits:", error);
    return NextResponse.json(
      { error: "Failed to fetch commits" },
      { status: 500 }
    );
  }
} 