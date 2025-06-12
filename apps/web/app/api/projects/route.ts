import { NextRequest, NextResponse } from "next/server";
import { createProject, getUserProjects, updateProject } from "@shipvibes/database";
import { createAuthServerClient } from "@shipvibes/database";
import { cookies } from "next/headers";
import { getSupabaseServerClient, ProjectQueries } from "@shipvibes/database";
// Project logger removed - using console.log instead

// Загружаем переменные окружения
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config({ path: '.env.local' });
}

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

    // Проверяем лимиты проектов
    const email = user.email;
    if (!email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    // Проверяем текущее количество проектов пользователя
    const { data: existingProjects, error: countError } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', user.id);

    if (countError) {
      console.error("Error counting projects:", countError);
      return NextResponse.json(
        { error: "Failed to check project limits" },
        { status: 500 }
      );
    }

    const projectCount = existingProjects?.length || 0;
    const FREE_TIER_LIMIT = 1;

    // Проверяем подписку через 21st.dev API
    let hasActiveSubscription = false;
    const subscriptionApiKey = process.env.SUBSCRIPTION_API_KEY;
    
    if (subscriptionApiKey) {
      try {
        const subscriptionResponse = await fetch(
          `https://api.21st.dev/v1/customers/${encodeURIComponent(email)}/subscription`,
          {
            headers: {
              Authorization: `Bearer ${subscriptionApiKey}`,
            },
          }
        );

        if (subscriptionResponse.ok) {
          const subscriptionData = await subscriptionResponse.json();
          hasActiveSubscription = subscriptionData.status === 'active';
          console.log(`🔍 Subscription check for ${email}:`, {
            status: subscriptionData.status,
            hasActiveSubscription
          });
        } else {
          console.log(`⚠️ Subscription API returned ${subscriptionResponse.status} for ${email}`);
        }
      } catch (subscriptionError) {
        console.error("Error checking subscription:", subscriptionError);
        // Продолжаем без проверки подписки если API недоступен
      }
    }

    // Проверяем лимиты (отключено в dev окружении)
    if (process.env.NODE_ENV !== 'development' && !hasActiveSubscription && projectCount >= FREE_TIER_LIMIT) {
      return NextResponse.json(
        { 
          error: "Project limit exceeded",
          message: `Free plan allows up to ${FREE_TIER_LIMIT} projects. Upgrade to Pro for unlimited projects.`,
          currentCount: projectCount,
          maxProjects: FREE_TIER_LIMIT
        },
        { status: 403 }
      );
    }

    // ✅ 1. СРАЗУ создаем проект в БД (быстрая операция)
    const project = await createProject({
      name,
      template_type,
      user_id: user.id,
    });

    console.log(`🎉 Project created: ${project.id} by user ${user.id}`);

    // ✅ 2. НЕМЕДЛЕННО возвращаем ответ пользователю для быстрого redirect
    const response = NextResponse.json({
      project: {
        ...project,
        deploy_status: "pending", // Показываем что проект инициализируется
      },
      downloadUrl: `/api/projects/${project.id}/download`,
      status: "pending", // Клиент знает что проект инициализируется
      message: "Project created! Setting up GitHub repository and template files..."
    });

    // ✅ 3. Запускаем тяжелые операции АСИНХРОННО в фоне (без await!)
    // Это не блокирует возврат ответа пользователю
    initializeProjectInBackground(project.id, name, template_type, user.id)
      .catch(error => {
        console.error(`❌ [PROJECT_CREATION] Background initialization failed for ${project.id}:`, error);
      });

    return response;

  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

/**
 * ✅ Асинхронная инициализация проекта в фоне
 * Не блокирует HTTP ответ пользователю
 */
async function initializeProjectInBackground(
  projectId: string,
  projectName: string,
  templateType: string,
  userId: string
): Promise<void> {
  try {
    console.log(`🚀 [PROJECT_INIT_BG] Starting background initialization for ${projectId}...`);
    
    const websocketServerUrl = process.env.WEBSOCKET_SERVER_URL || 'http://localhost:8080';
    
    // 1. Создаем GitHub репозиторий
    console.log(`🔄 [PROJECT_INIT_BG] Creating GitHub repository...`);
    const repoResponse = await fetch(`${websocketServerUrl}/api/projects/create-repository`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        projectName
      })
    });

    if (!repoResponse.ok) {
      const errorText = await repoResponse.text();
      console.error(`❌ [PROJECT_INIT_BG] GitHub repository creation failed:`, errorText);
      throw new Error(`Repository creation failed: ${errorText}`);
    }

    const repoData = await repoResponse.json();
    const repository = repoData.repository;
    
    console.log(`✅ [PROJECT_INIT_BG] GitHub repository created: ${repository.html_url}`);

    // 2. Инициализируем шаблон
    console.log(`🔄 [PROJECT_INIT_BG] Starting template upload...`);
    const initResponse = await fetch(`${websocketServerUrl}/api/projects/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        templateType,
        projectName,
        repositoryName: repository.name
      })
    });

    if (initResponse.ok) {
      console.log(`✅ [PROJECT_INIT_BG] Template upload initiated for ${projectId}`);
    } else {
      const errorText = await initResponse.text();
      console.error(`❌ [PROJECT_INIT_BG] Template upload failed:`, errorText);
      throw new Error(`Template upload failed: ${errorText}`);
    }

  } catch (error) {
    console.error(`❌ [PROJECT_INIT_BG] Background initialization failed for ${projectId}:`, error);
    
    // Обновляем статус проекта на failed
    try {
      const supabaseClient = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabaseClient);
      await projectQueries.updateProject(projectId, {
        deploy_status: "failed"
      });
      console.log(`📊 Updated project ${projectId} status to failed`);
    } catch (updateError) {
      console.error(`❌ Error updating project status for ${projectId}:`, updateError);
    }
    
    // Rethrow для логирования в catch блоке выше
    throw error;
  }
}

// ✅ Функции generateTemplateFiles, collectTemplateFiles и uploadTemplateFilesInBackground
// перенесены в WebSocket сервер для надежного выполнения в non-serverless окружении

