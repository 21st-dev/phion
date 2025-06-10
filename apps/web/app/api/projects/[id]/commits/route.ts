import { NextRequest, NextResponse } from "next/server";
import { getProjectCommits, getCommitFiles } from "@shipvibes/database";
import { cookies } from "next/headers";
import { createAuthServerClient } from "@shipvibes/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    
    const cookieStore = await cookies();
    const supabase = createAuthServerClient({
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Игнорируем ошибки установки cookies
        }
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const commitId = searchParams.get('commit_id');
    
    if (commitId) {
      // Получить файлы конкретного коммита
      const files = await getCommitFiles(commitId);
      return NextResponse.json({ files });
    } else {
      // Получить список коммитов проекта
      const commits = await getProjectCommits(projectId);
      return NextResponse.json({ commits });
    }
  } catch (error) {
    console.error("Error fetching commits:", error);
    return NextResponse.json(
      { error: "Failed to fetch commits" },
      { status: 500 }
    );
  }
} 