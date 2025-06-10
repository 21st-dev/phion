import React from "react";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Header } from "@/components/layout/header";
import { ProjectNavigation } from "@/components/project/project-navigation";
import { ProjectWebSocketProvider } from "@/components/project/project-websocket-provider";
import { ProjectLayoutClient } from "@/components/project/project-layout-client";
import { ProjectLogsOverlay } from "@/components/project/project-logs-overlay";
import {
  getProjectById,
  getProjectFileHistory,
  getPendingChanges,
  createAuthServerClient,
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

  const [project, history, pendingChanges] = await Promise.all([
    getProjectById(id),
    getProjectFileHistory(id, 50),
    getPendingChanges(id),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <ProjectLayoutClient
      project={project}
      initialHistory={history}
      initialPendingChanges={pendingChanges}
    >
      <ProjectWebSocketProvider
        project={project}
        initialHistory={history}
        initialPendingChanges={pendingChanges}
      >
        <div className="min-h-screen bg-background-100">
          {/* Используем единый Header как на главной */}
          <Header user={user} project={project} />

          {/* Navigation Tabs */}
          <div className="border-b border-border bg-card">
            <div className="container mx-auto px-6">
              <ProjectNavigation projectId={project.id} />
            </div>
          </div>

          {/* Page Content */}
          <div className="container mx-auto px-6 py-8">{children}</div>

          {/* Floating logs overlay */}
          <ProjectLogsOverlay projectId={project.id} />
        </div>
      </ProjectWebSocketProvider>
    </ProjectLayoutClient>
  );
}
