import { notFound } from "next/navigation";
import { ProjectHeader } from "@/components/project-header";
import { ProjectPageClient } from "@/components/project-page-client";
import { getSupabaseServerClient } from "@shipvibes/database";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id: projectId } = await params;
  const supabase = getSupabaseServerClient();

  // Получаем данные проекта
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
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

  return (
    <div className="container mx-auto px-4 py-8">
      <ProjectHeader project={project as any} />
      <ProjectPageClient
        initialProject={project as any}
        initialHistory={(fileHistory || []) as any}
      />
    </div>
  );
}
