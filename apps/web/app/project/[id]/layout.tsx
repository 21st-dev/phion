import React from "react";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Header } from "@/components/layout/header";
import { ProjectNavigation } from "@/components/project/project-navigation";
import { ProjectLayoutClient } from "@/components/project/project-layout-client";
import {
  getProjectById,
  getPendingChanges,
  createAuthServerClient,
  getSupabaseServerClient,
  CommitHistoryQueries,
} from "@shipvibes/database";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { id } = await params;

  // Получаем пользователя для Header
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
        // Игнорируем ошибки установки cookies в Server Components
      }
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Если пользователь не авторизован, перенаправляем на страницу входа
  if (!user) {
    redirect("/login");
  }

  // Получаем историю коммитов (как в API роуте)
  const supabaseServer = getSupabaseServerClient();
  const commitHistoryQueries = new CommitHistoryQueries(supabaseServer);

  const [project, commits, pendingChanges] = await Promise.all([
    getProjectById(id),
    commitHistoryQueries.getProjectCommitHistory(id),
    getPendingChanges(id),
  ]);

  // Преобразуем коммиты в формат для UI (как в API роуте)
  const history = commits.map((commit) => ({
    commit_id: commit.github_commit_sha,
    commit_message: commit.commit_message,
    created_at: commit.created_at,
    project_id: commit.project_id,
    files_count: commit.files_count || 0,
  }));

  // Логируем что получили из database queries
  console.log("🎯 [ProjectLayout] Server-side data loaded:", {
    projectId: id,
    projectExists: !!project,
    commitsFromDB: commits?.length || 0,
    historyLength: history?.length || 0,
    history: history,
    pendingChangesLength: pendingChanges?.length || 0,
    pendingChanges: pendingChanges,
  });

  if (!project) {
    notFound();
  }

  return (
    <ProjectLayoutClient
      project={project}
      initialHistory={history}
      initialPendingChanges={pendingChanges}
    >
      <div className="min-h-screen bg-background-100">
        {/* Используем единый Header как на главной */}
        <Header user={user} project={project} />

        {/* Navigation Tabs */}
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ProjectNavigation projectId={project.id} project={project} />
          </div>
        </div>

        {/* Page Content */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </div>
    </ProjectLayoutClient>
  );
}
