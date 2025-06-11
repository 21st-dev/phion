import { NextRequest, NextResponse } from "next/server";
import { createProject, getUserProjects, updateProject } from "@shipvibes/database";
import { createAuthServerClient } from "@shipvibes/database";
import { cookies } from "next/headers";
import { getSupabaseServerClient, ProjectQueries } from "@shipvibes/database";
// Server-side import for the project logger
import { projectLogger } from "@shipvibes/shared/project-logger-server";

export async function GET(request: NextRequest) {
  try {
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

    // Получаем проекты пользователя (RLS автоматически фильтрует)
    const projects = await getUserProjects(user.id);
    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { name, template_type } = body;

    if (!name || !template_type) {
      return NextResponse.json(
        { error: "Name and template_type are required" },
        { status: 400 }
      );
    }

    // Создаем проект с привязкой к пользователю
    const project = await createProject({
      name,
      template_type,
      user_id: user.id, // Привязываем к текущему пользователю
    });

    // Логируем создание проекта
    await projectLogger.logProjectCreated(
      project.id,
      project,
      'api_request'
    );

    try {
      console.log(`🚀 [PROJECT_CREATION] Starting GitHub-based project creation for ${project.id}`);
      
      const websocketServerUrl = process.env.WEBSOCKET_SERVER_URL || 'http://localhost:8080';
      
      // 1. 🚀 ВЫЗЫВАЕМ WebSocket сервер для создания GitHub репозитория (безопасно для serverless)
      console.log(`🔄 [PROJECT_CREATION] Creating GitHub repository via WebSocket server...`);
      const repoResponse = await fetch(`${websocketServerUrl}/api/projects/create-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          projectName: name
        })
      });

      if (!repoResponse.ok) {
        const errorText = await repoResponse.text();
        console.error(`❌ [PROJECT_CREATION] GitHub repository creation failed:`, errorText);
        throw new Error(`Repository creation failed: ${errorText}`);
      }

      const repoData = await repoResponse.json();
      const repository = repoData.repository;
      
      console.log(`✅ [PROJECT_CREATION] GitHub repository created: ${repository.html_url}`);

      // 2. Устанавливаем статус "pending" пока проект инициализируется
      const supabaseClient = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabaseClient);
      
      await projectQueries.updateProject(project.id, {
        deploy_status: "pending"
      });

      // 3. 🚀 ВЫЗЫВАЕМ WebSocket сервер для инициализации шаблона (безопасно для serverless)
      console.log(`🔄 [PROJECT_CREATION] Starting template upload via WebSocket server...`);
      const initResponse = await fetch(`${websocketServerUrl}/api/projects/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project.id,
          templateType: template_type,
          projectName: name,
          repositoryName: repository.name
        })
      });

      if (initResponse.ok) {
        console.log(`✅ [PROJECT_CREATION] Template upload initiated via WebSocket server`);
      } else {
        const errorText = await initResponse.text();
        console.error(`❌ [PROJECT_CREATION] WebSocket server init failed:`, errorText);
        // Обновляем статус на failed
        await projectQueries.updateProject(project.id, { deploy_status: "failed" });
      }

      // 4. 🎯 НЕМЕДЛЕННО возвращаем ответ пользователю
      console.log(`✅ [PROJECT_CREATION] Project created, files uploading in background...`);
      
      return NextResponse.json({
        project: {
          ...project,
          github_repo_url: repository.html_url,
          github_repo_name: repository.name,
          github_owner: 'vybcel',
          deploy_status: "pending" // Показываем что проект инициализируется
        },
        downloadUrl: `/api/projects/${project.id}/download`,
        githubUrl: repository.html_url,
        status: "pending", // Клиент знает что проект инициализируется
        message: "Project created! Template files are being uploaded in the background..."
      });

    } catch (error) {
      console.error("❌ [PROJECT_CREATION] Error in project creation:", error);
      
      // Обновляем статус проекта на failed при любой ошибке
      try {
        const supabaseClient = getSupabaseServerClient();
        const projectQueries = new ProjectQueries(supabaseClient);
        await projectQueries.updateProject(project.id, {
          deploy_status: "failed"
        });
      } catch (updateError) {
        console.error("❌ Error updating project status:", updateError);
      }
      
      return NextResponse.json({
        project,
        downloadUrl: `/api/projects/${project.id}/download`,
        error: "Project initialization failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

// ✅ Функции generateTemplateFiles, collectTemplateFiles и uploadTemplateFilesInBackground
// перенесены в WebSocket сервер для надежного выполнения в non-serverless окружении

