import { NextRequest, NextResponse } from "next/server";
import { createProject, getUserProjects, updateProject } from "@shipvibes/database";
import { createAuthServerClient } from "@shipvibes/database";
import { cookies } from "next/headers";
import path from "path";
import fs from "fs";
import { getSupabaseServerClient, ProjectQueries, CommitHistoryQueries } from "@shipvibes/database";
// Server-side import for the project logger
import { projectLogger } from "@shipvibes/shared/project-logger-server";
// Добавляем GitHub App service
import { githubAppService } from "@/lib/github-service";
// Добавляем Netlify service
import { netlifyService } from "@/lib/netlify-service";

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
      
      // 1. Создаем GitHub репозиторий
      const repository = await githubAppService.createRepository(
        project.id,
        `Vybcel project: ${project.name}`
      );
      
      console.log(`✅ [PROJECT_CREATION] GitHub repository created: ${repository.html_url}`);

      // 2. Обновляем проект с GitHub данными
      const supabaseClient = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabaseClient);
      
      await projectQueries.updateGitHubInfo(project.id, {
        github_repo_url: repository.html_url,
        github_repo_name: repository.name,
        github_owner: 'vybcel'
      });

      // 3. Устанавливаем статус "pending" пока проект инициализируется
      await projectQueries.updateProject(project.id, {
        deploy_status: "pending"
      });

      // 4. 🚀 АСИНХРОННО загружаем файлы в фоне
      console.log(`🔄 [PROJECT_CREATION] Starting background template upload...`);
      uploadTemplateFilesInBackground(project.id, template_type, name, repository.name)
        .catch(error => {
          console.error(`❌ [PROJECT_CREATION] Background upload failed for ${project.id}:`, error);
          // Обновляем статус на failed
          projectQueries.updateProject(project.id, { deploy_status: "failed" });
        });

      // 5. 🎯 НЕМЕДЛЕННО возвращаем ответ пользователю
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

    } catch (githubError) {
      console.error("❌ [PROJECT_CREATION] Error with GitHub operations:", githubError);
      
      // Проект создан в БД, но GitHub setup не удался
      await updateProject(project.id, {
        deploy_status: "failed"
      });
      
      return NextResponse.json({
        project,
        downloadUrl: `/api/projects/${project.id}/download`,
        error: "GitHub setup failed but project was created"
      });
    }
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

/**
 * Генерирует файлы шаблона с настройками проекта
 * Заменяет старую функцию generateAndUploadTemplate
 */
async function generateTemplateFiles(
  projectId: string,
  templateType: string,
  projectName: string
): Promise<Record<string, string>> {
  console.log(`🔄 [TEMPLATE] Generating template files for ${projectId} (${templateType})`);
  
  // Путь к шаблону
  const templatePath = path.join(process.cwd(), "..", "..", "templates", templateType);
  
  if (!fs.existsSync(templatePath)) {
    // Пробуем альтернативный путь
    const alternativeTemplatePath = path.join(process.cwd(), "templates", templateType);
    if (!fs.existsSync(alternativeTemplatePath)) {
      throw new Error(`Template ${templateType} not found`);
    }
    return await collectTemplateFiles(alternativeTemplatePath, projectName, projectId);
  }
  
  return await collectTemplateFiles(templatePath, projectName, projectId);
}

/**
 * Собирает все файлы из шаблона и применяет необходимые трансформации
 */
async function collectTemplateFiles(
  templatePath: string,
  projectName: string,
  projectId: string
): Promise<Record<string, string>> {
  const templateFiles: Record<string, string> = {};
  
  function collectFiles(dirPath: string, relativePath: string = ''): void {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      // Пропускаем служебные папки
      if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist' || item.name === '.next') {
        continue;
      }
      
      const fullPath = path.join(dirPath, item.name);
      const relativeFilePath = relativePath ? path.join(relativePath, item.name) : item.name;
      
      if (item.isDirectory()) {
        collectFiles(fullPath, relativeFilePath);
      } else {
        let content = fs.readFileSync(fullPath, 'utf-8');
        
        // Применяем трансформации для специальных файлов
        if (item.name === 'package.json') {
          const packageJson = JSON.parse(content);
          packageJson.name = projectName.toLowerCase().replace(/\s+/g, '-');
          content = JSON.stringify(packageJson, null, 2);
        } else if (item.name === 'vybcel.config.json') {
          // Заменяем PROJECT_ID в конфигурационном файле
          content = content.replace(/__PROJECT_ID__/g, projectId);
        }
        
        // Нормализуем пути (заменяем \ на /)
        const normalizedPath = relativeFilePath.replace(/\\/g, '/');
        templateFiles[normalizedPath] = content;
      }
    }
  }
  
  collectFiles(templatePath);
  
  console.log(`📋 [TEMPLATE] Collected ${Object.keys(templateFiles).length} files from template`);
  return templateFiles;
}

/**
 * 🚀 НОВАЯ ФУНКЦИЯ: Асинхронная загрузка файлов шаблона в фоне
 * Не блокирует ответ API - выполняется в background
 */
async function uploadTemplateFilesInBackground(
  projectId: string,
  templateType: string,
  projectName: string,
  repositoryName: string
): Promise<void> {
  console.log(`🔄 [BACKGROUND] Starting template upload for ${projectId}...`);
  
  try {
    const supabaseClient = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabaseClient);
    const commitHistoryQueries = new CommitHistoryQueries(supabaseClient);

    // 1. Генерируем файлы шаблона 
    const templateFiles = await generateTemplateFiles(projectId, templateType, projectName);
    console.log(`📋 [BACKGROUND] Generated ${Object.keys(templateFiles).length} template files`);

    // 2. 🚀 Загружаем все файлы ОДНИМ КОММИТОМ (избегаем конфликтов)
    const result = await githubAppService.createMultipleFiles(
      repositoryName,
      templateFiles,
      'Initial commit from template'
    );
    
    console.log(`✅ [BACKGROUND] Uploaded ${Object.keys(templateFiles).length} files in one commit`);
    const mainCommitSha = result.commitSha;

    // 3. Создаем запись в commit_history
    if (mainCommitSha) {
      await commitHistoryQueries.createCommitHistory({
        project_id: projectId,
        commit_message: 'Initial commit from template',
        github_commit_sha: mainCommitSha,
        github_commit_url: `https://github.com/vybcel/${repositoryName}/commit/${mainCommitSha}`,
        files_count: Object.keys(templateFiles).length
      });
    }

    // 4. ✅ ТЕПЕРЬ НЕ СОЗДАЕМ NETLIFY САЙТ СРАЗУ!
    // Netlify сайт будет создан только при первом Save All Changes пользователя
    // Это позволит показать онбординг пользователю
    
    // Обновляем статус проекта как готовый к скачиванию (но без netlify_site_id)
    await projectQueries.updateProject(projectId, {
      deploy_status: "ready" // Проект готов к скачиванию и разработке
    });

    // 5. 🚀 ВАЖНО: Отправляем WebSocket событие о завершении инициализации
    try {
      const websocketServerUrl = process.env.WEBSOCKET_SERVER_URL || 'http://localhost:8080';
      const notifyResponse = await fetch(`${websocketServerUrl}/api/notify-status-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          status: 'ready',
          message: 'Project initialization completed'
        })
      });

      if (notifyResponse.ok) {
        console.log(`📡 [BACKGROUND] WebSocket notification sent for project ${projectId}`);
      } else {
        console.error(`⚠️ [BACKGROUND] Failed to send WebSocket notification for project ${projectId}`);
      }
    } catch (notifyError) {
      console.error(`❌ [BACKGROUND] Error sending WebSocket notification:`, notifyError);
    }

    console.log(`🎉 [BACKGROUND] Template upload completed for ${projectId}! Project ready for development.`);

  } catch (error) {
    console.error(`❌ [BACKGROUND] Template upload failed for ${projectId}:`, error);
    
    // Обновляем статус на failed
    const supabaseClient = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabaseClient);
    await projectQueries.updateProject(projectId, {
      deploy_status: "failed"
    });

    // Отправляем WebSocket событие об ошибке
    try {
      const websocketServerUrl = process.env.WEBSOCKET_SERVER_URL || 'http://localhost:8080';
      await fetch(`${websocketServerUrl}/api/notify-status-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          status: 'failed',
          message: 'Project initialization failed'
        })
      });
    } catch (notifyError) {
      console.error(`❌ [BACKGROUND] Error sending failure WebSocket notification:`, notifyError);
    }
    
    throw error;
  }
}

