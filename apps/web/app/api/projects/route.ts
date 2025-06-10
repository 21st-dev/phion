import { NextRequest, NextResponse } from "next/server";
import { getAllProjects, createProject, getUserProjects, updateProject } from "@shipvibes/database";
import { createAuthServerClient } from "@shipvibes/database";
import { uploadProjectTemplate, uploadTextFile, uploadFileVersion } from "@shipvibes/storage";
import { cookies } from "next/headers";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import archiver from "archiver";
import { CreateProject } from "@shipvibes/shared";
import { getSupabaseServerClient, ProjectQueries, FileHistoryQueries } from "@shipvibes/database";
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

    // Создаем ZIP шаблона для скачивания
    try {
      await generateAndUploadTemplate(project.id, template_type, name);
    } catch (templateError) {
      console.error("Error generating template:", templateError);
      // Проект уже создан, но шаблон не загружен
    }

    // Запускаем сохранение файлов шаблона как первый коммит в фоне
    // НЕ блокируем ответ пользователю
    saveTemplateAsInitialCommit(project.id, template_type, name).catch((error) => {
      console.error("Error saving template as initial commit:", error);
    });

    // TODO: Создание сайта на Netlify

    return NextResponse.json({
      project,
      downloadUrl: `/api/projects/${project.id}/download`,
    });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

async function generateAndUploadTemplate(
  projectId: string,
  templateType: string,
  projectName: string
): Promise<void> {
  console.log(`🔄 [TEMPLATE] Starting template generation for ${projectId} (${templateType})`);
  
  // Путь к шаблону (в корне проекта)
  const templatePath = path.join(process.cwd(), "..", "..", "templates", templateType);
  
  console.log(`📂 [TEMPLATE] Looking for template at: ${templatePath}`);
  console.log(`📂 [TEMPLATE] Current working directory: ${process.cwd()}`);
  
  // Проверим существование шаблона
  if (!fs.existsSync(templatePath)) {
    // Попробуем относительный путь от корня монорепо
    const alternativeTemplatePath = path.join(process.cwd(), "templates", templateType);
    console.log(`📂 [TEMPLATE] Trying alternative path: ${alternativeTemplatePath}`);
    
    if (!fs.existsSync(alternativeTemplatePath)) {
      console.error(`❌ [TEMPLATE] Template ${templateType} not found at either:
        - ${templatePath}
        - ${alternativeTemplatePath}`);
      throw new Error(`Template ${templateType} not found`);
    }
    
    console.log(`✅ [TEMPLATE] Template found at alternative path`);
    await createTemplateFromPath(alternativeTemplatePath, projectName, projectId);
  } else {
    console.log(`✅ [TEMPLATE] Template found at original path`);
    await createTemplateFromPath(templatePath, projectName, projectId);
  }
}

async function createTemplateFromPath(
  templatePath: string,
  projectName: string,
  projectId: string
): Promise<void> {
  console.log(`🏗️ [TEMPLATE] Creating ZIP archive from ${templatePath}`);
  
  // Создаем ZIP архив шаблона
  const zipBuffer = await createTemplateZip(templatePath, projectName, projectId);
  
  console.log(`✅ [TEMPLATE] ZIP archive created, size: ${zipBuffer.length} bytes`);
  
  // Загружаем в R2
  console.log(`📤 [TEMPLATE] Uploading to R2 for project ${projectId}...`);
  const uploadResult = await uploadProjectTemplate(projectId, zipBuffer);
  
  console.log(`✅ [TEMPLATE] Upload successful:`, uploadResult);
}

async function createTemplateZip(templatePath: string, projectName: string, projectId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    console.log(`📦 [ZIP] Starting ZIP creation for ${templatePath}`);
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Uint8Array[] = [];

    archive.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    archive.on('end', () => {
      const buffer = Buffer.concat(chunks);
      console.log(`✅ [ZIP] Archive finalized, total size: ${buffer.length} bytes`);
      resolve(buffer);
    });
    archive.on('error', (error) => {
      console.error(`❌ [ZIP] Archive error:`, error);
      reject(error);
    });

    console.log(`📂 [ZIP] Reading template directory: ${templatePath}`);

    // Читаем все файлы из шаблона
    let files;
    try {
      files = fs.readdirSync(templatePath, { withFileTypes: true });
      console.log(`📋 [ZIP] Found ${files.length} items in template:`, files.map(f => f.name));
    } catch (error) {
      console.error(`❌ [ZIP] Error reading template directory:`, error);
      reject(error);
      return;
    }
    
    let processedFiles = 0;
    
    for (const file of files) {
      const filePath = path.join(templatePath, file.name);
      console.log(`📄 [ZIP] Processing: ${file.name} (${file.isDirectory() ? 'directory' : 'file'})`);
      
      try {
        if (file.isDirectory()) {
          // Добавляем директорию рекурсивно
          archive.directory(filePath, file.name);
          console.log(`📁 [ZIP] Added directory: ${file.name}`);
        } else if (file.name === 'package.json') {
          // Обновляем package.json с именем проекта
          const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          packageJson.name = projectName.toLowerCase().replace(/\s+/g, '-');
          archive.append(JSON.stringify(packageJson, null, 2), { name: 'package.json' });
          console.log(`📝 [ZIP] Updated package.json with project name: ${packageJson.name}`);
        } else if (file.name === 'shipvibes-dev.js') {
          // Обновляем shipvibes-dev.js с PROJECT_ID
          let agentContent = fs.readFileSync(filePath, 'utf-8');
          agentContent = agentContent.replace(/__PROJECT_ID__/g, projectId);
          archive.append(agentContent, { name: 'shipvibes-dev.js' });
          console.log(`🔧 [ZIP] Updated shipvibes-dev.js with project ID: ${projectId}`);
        } else {
          // Добавляем файл как есть
          archive.file(filePath, { name: file.name });
          console.log(`📄 [ZIP] Added file: ${file.name}`);
        }
        processedFiles++;
      } catch (fileError) {
        console.error(`❌ [ZIP] Error processing file ${file.name}:`, fileError);
      }
    }

    console.log(`✅ [ZIP] Processed ${processedFiles}/${files.length} items, finalizing archive...`);
    archive.finalize();
  });
}

/**
 * Сохранить файлы шаблона как первый коммит в истории проекта
 */
async function saveTemplateAsInitialCommit(
  projectId: string,
  templateType: string,
  projectName: string
): Promise<string> {
  console.log(`💾 [INITIAL_COMMIT] Saving template files as initial commit for ${projectId}`);
  
  // Определяем путь к шаблону (такая же логика как в generateAndUploadTemplate)
  let templatePath = path.join(process.cwd(), "..", "..", "templates", templateType);
  
  if (!fs.existsSync(templatePath)) {
    templatePath = path.join(process.cwd(), "templates", templateType);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template ${templateType} not found`);
    }
  }
  
  // Собираем все файлы из шаблона
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
        
        // Применяем те же трансформации что и в createTemplateZip
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
  
  console.log(`📋 [INITIAL_COMMIT] Collected ${Object.keys(templateFiles).length} files from template`);
  
  // Создаем коммит
  const commitId = crypto.randomUUID();
  const commitMessage = 'Initial commit from template';
  
  const supabase = getSupabaseServerClient();
  const historyQueries = new FileHistoryQueries(supabase);
  
  // Сохраняем каждый файл в R2 и создаем запись в file_history
  for (const [filePath, content] of Object.entries(templateFiles)) {
    try {
      // Загружаем файл в R2 в структуре версий
      await uploadFileVersion(projectId, commitId, filePath, content);
      
      // Создаем запись в file_history
      await historyQueries.createFileHistory({
        project_id: projectId,
        file_path: filePath,
        r2_object_key: `projects/${projectId}/versions/${commitId}/${filePath}`,
        content_hash: crypto.createHash('sha256').update(content).digest('hex'),
        file_size: Buffer.byteLength(content, 'utf-8'),
        commit_id: commitId,
        commit_message: commitMessage
      });
      
      console.log(`💾 [INITIAL_COMMIT] Saved file: ${filePath} (${content.length} chars)`);
    } catch (error) {
      console.error(`❌ [INITIAL_COMMIT] Error saving file ${filePath}:`, error);
      // Продолжаем с другими файлами
    }
  }
  
  // Логируем создание коммита
  await projectLogger.logCommitCreated(
    projectId,
    commitId,
    commitMessage,
    Object.keys(templateFiles).length,
    'initial_template_save'
  );

  // Обновляем статус проекта на "ready" после завершения инициализации
  try {
    await updateProject(projectId, {
      deploy_status: "ready"
    });
    console.log(`✅ [INITIAL_COMMIT] Project ${projectId} status updated to ready`);
  } catch (statusError) {
    console.error(`❌ [INITIAL_COMMIT] Failed to update project status:`, statusError);
  }
  
  console.log(`✅ [INITIAL_COMMIT] Template files saved as commit ${commitId} for project ${projectId}`);
  return commitId;
}

