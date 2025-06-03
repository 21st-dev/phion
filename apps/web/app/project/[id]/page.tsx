import { notFound } from "next/navigation";
import { ProjectHeader } from "@/components/project-header";
import { ProjectPageClient } from "@/components/project-page-client";
import { Header } from "@/components/layout/header";
import {
  createAuthServerClient,
  getSupabaseServerClient,
  PendingChangesQueries,
} from "@shipvibes/database";
import { cookies } from "next/headers";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
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
        // Игнорируем ошибки установки cookies в Server Components
      }
    },
  });

  // Проверяем авторизацию
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Получаем данные проекта с проверкой владельца
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    notFound();
  }

  // Получаем историю файлов для проекта
  const { data: fileHistory, error: historyError } = await supabase
    .from("file_history")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  // Получаем pending changes
  const serverSupabase = getSupabaseServerClient();
  const pendingQueries = new PendingChangesQueries(serverSupabase);
  let pendingChanges: any[] = [];
  try {
    pendingChanges = await pendingQueries.getPendingChanges(projectId);
  } catch (error) {
    console.error("Error fetching pending changes:", error);
  }

  const hasVersions = fileHistory && fileHistory.length > 0;

  return (
    <div className="min-h-screen bg-background-100">
      <Header user={user} project={project} />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <ProjectHeader
          project={project as any}
          hideDownloadButton={!hasVersions}
        />
        <ProjectPageClient
          initialProject={project as any}
          initialHistory={(fileHistory || []) as any}
          initialPendingChanges={pendingChanges as any}
        />
      </main>
    </div>
  );
}
