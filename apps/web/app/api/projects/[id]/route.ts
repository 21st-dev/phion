import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient, ProjectQueries } from "@shipvibes/database";
import { cookies } from "next/headers";
import { githubAppService } from "@/lib/github-service";

/**
 * Удалить Netlify сайт через API
 */
async function deleteNetlifySite(siteId: string): Promise<void> {
  const netlifyToken = process.env.NETLIFY_ACCESS_TOKEN;

  if (!netlifyToken) {
    throw new Error("NETLIFY_ACCESS_TOKEN not configured");
  }

  const response = await fetch(
    `https://api.netlify.com/api/v1/sites/${siteId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to delete Netlify site: ${response.status} ${errorText}`,
    );
  }
}

async function getAuthenticatedUser(_request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createAuthServerClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
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
    return { user: null, supabase: null, error: "Unauthorized" };
  }

  return { user, supabase, error: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { supabase, error } = await getAuthenticatedUser(request);
    if (error || !supabase) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const projectQueries = new ProjectQueries(supabase);

    // RLS автоматически проверит, что пользователь имеет доступ к проекту
    const project = await projectQueries.getProjectById(id);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error getting project:", error);
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { supabase, error } = await getAuthenticatedUser(request);
    if (error || !supabase) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const projectQueries = new ProjectQueries(supabase);

    // RLS автоматически проверит, что пользователь может обновить проект
    const updatedProject = await projectQueries.updateProject(id, body);

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const { supabase, error } = await getAuthenticatedUser(request);
    if (error || !supabase) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const projectQueries = new ProjectQueries(supabase);

    // Сначала получаем информацию о проекте для удаления Netlify сайта
    const project = await projectQueries.getProjectById(id);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 },
      );
    }

    console.log(`🗑️ Deleting project ${id}: ${project.name}`);

    // Если у проекта есть Netlify сайт, удаляем его
    if (project.netlify_site_id) {
      try {
        console.log(`🌐 Deleting Netlify site: ${project.netlify_site_id}`);
        await deleteNetlifySite(project.netlify_site_id);
        console.log(
          `✅ Netlify site deleted successfully: ${project.netlify_site_id}`,
        );
      } catch (netlifyError) {
        console.error(
          `❌ Error deleting Netlify site ${project.netlify_site_id}:`,
          netlifyError,
        );
        // Продолжаем удаление проекта даже если не удалось удалить Netlify сайт
        // Это может произойти если сайт уже был удален вручную или есть проблемы с API
      }
    } else {
      console.log(`📝 Project ${id} has no Netlify site to delete`);
    }

    // Если у проекта есть GitHub репозиторий, удаляем его
    if (project.github_repo_name) {
      try {
        console.log(
          `🐙 Deleting GitHub repository: ${project.github_repo_name}`,
        );
        await githubAppService.deleteRepository(project.github_repo_name);
        console.log(
          `✅ GitHub repository deleted successfully: ${project.github_repo_name}`,
        );
      } catch (githubError) {
        console.error(
          `❌ Error deleting GitHub repository ${project.github_repo_name}:`,
          githubError,
        );
        // Продолжаем удаление проекта даже если не удалось удалить GitHub репозиторий
        // Это может произойти если репозиторий уже был удален вручную или есть проблемы с API
      }
    } else {
      console.log(`📝 Project ${id} has no GitHub repository to delete`);
    }

    // Удаляем проект из базы данных
    console.log(`🗄️ Deleting project from database: ${id}`);
    await projectQueries.deleteProject(id);
    console.log(`✅ Project deleted successfully: ${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 },
    );
  }
}
