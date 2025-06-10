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
    const projects = await getUserProjects();
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
        `Shipvibes project: ${project.name}`
      );
      
      console.log(`✅ [PROJECT_CREATION] GitHub repository created: ${repository.html_url}`);

      // 2. Обновляем проект с GitHub данными
      const supabaseClient = getSupabaseServerClient();
      const projectQueries = new ProjectQueries(supabaseClient);
      
      await projectQueries.updateGitHubInfo(project.id, {
        github_repo_url: repository.html_url,
        github_repo_name: repository.name,
        github_owner: 'shipvibes'
      });

      // 3. Устанавливаем статус "building" пока файлы загружаются
      await projectQueries.updateProject(project.id, {
        deploy_status: "building"
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
          github_owner: 'shipvibes',
          deploy_status: "building" // Показываем что идет процесс
        },
        downloadUrl: `/api/projects/${project.id}/download`,
        githubUrl: repository.html_url,
        status: "building", // Клиент знает что нужно ждать
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
        } else if (item.name === 'shipvibes-dev.js') {
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
        github_commit_url: `https://github.com/shipvibes/${repositoryName}/commit/${mainCommitSha}`,
        files_count: Object.keys(templateFiles).length
      });
    }

    // 4. Создаем Netlify сайт с GitHub интеграцией (БЕЗ вебхуков)
    console.log(`🌐 [BACKGROUND] Creating Netlify site for ${projectId}...`);
    const netlifySite = await netlifyService.createSiteWithGitHub(
      projectId,
      projectName,
      repositoryName,
      'shipvibes'
    );

    // 5. СРАЗУ сохраняем netlify_site_id в базу данных!
    await projectQueries.updateProject(projectId, {
      netlify_site_id: netlifySite.id,
      // НЕ сохраняем netlify_url - получим его через webhook
      deploy_status: "building" // Ждем автоматический деплой от Netlify
    });
    
    console.log(`💾 [BACKGROUND] Netlify site ID saved to database: ${netlifySite.id}`);

    // 6. ТЕПЕРЬ настраиваем вебхуки - проект уже найдется в базе данных!
    console.log(`🔗 [BACKGROUND] Setting up webhooks for ${netlifySite.id}...`);
    await netlifyService.setupWebhookForSite(netlifySite.id, projectId);

    console.log(`🎉 [BACKGROUND] Template upload completed for ${projectId}! Netlify site created (${netlifySite.id}), waiting for auto-deploy...`);

  } catch (error) {
    console.error(`❌ [BACKGROUND] Template upload failed for ${projectId}:`, error);
    
    // Обновляем статус на failed
    const supabaseClient = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabaseClient);
    await projectQueries.updateProject(projectId, {
      deploy_status: "failed"
    });
    
    throw error;
  }
}

