import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@shipvibes/database";
import AdmZip from "adm-zip";
// Убираем R2 импорт
// import { downloadProjectTemplate } from "@shipvibes/storage";
// Добавляем GitHub App service
import { githubAppService } from "@/lib/github-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let projectId: string | undefined;
  
  try {
    const { id } = await params;
    projectId = id;
    
    console.log(`🔄 [DOWNLOAD] Starting GitHub-based download for project ${projectId}`);
    
    // Проверяем существование проекта
    console.log(`📋 [DOWNLOAD] Fetching project data for ${projectId}`);
    const project = await getProjectById(projectId);
    
    if (!project) {
      console.log(`❌ [DOWNLOAD] Project not found: ${projectId}`);
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    
    console.log(`✅ [DOWNLOAD] Project found: ${project.name} (template: ${project.template_type})`);

    // Проверяем, что у проекта есть GitHub репозиторий
    if (!project.github_repo_name) {
      console.log(`❌ [DOWNLOAD] Project ${projectId} has no GitHub repository`);
      return NextResponse.json(
        { error: "Project does not have a GitHub repository" },
        { status: 404 }
      );
    }

    // Скачиваем проект из GitHub
    console.log(`⬇️ [DOWNLOAD] Downloading ZIP from GitHub repository: ${project.github_repo_name}`);
    const downloadStartTime = Date.now();
    
    let originalProjectData: Buffer;
    try {
      originalProjectData = await githubAppService.downloadRepositoryZip(project.github_repo_name, 'main');
      const downloadTime = Date.now() - downloadStartTime;
      console.log(`✅ [DOWNLOAD] GitHub download completed in ${downloadTime}ms, size: ${originalProjectData?.length || 0} bytes`);
    } catch (downloadError) {
      console.error(`❌ [DOWNLOAD] GitHub download failed for project ${projectId}:`, downloadError);
      return NextResponse.json(
        { error: "Failed to download project from GitHub" },
        { status: 500 }
      );
    }
    
    if (!originalProjectData || originalProjectData.length === 0) {
      console.log(`❌ [DOWNLOAD] Empty or invalid project data from GitHub for ${projectId}`);
      return NextResponse.json(
        { error: "Project template is empty or corrupted" },
        { status: 404 }
      );
    }

    // Обрабатываем ZIP для переименования папки
    console.log(`🔄 [DOWNLOAD] Processing ZIP to rename root folder for project ${projectId}...`);
    const processingStartTime = Date.now();
    
    let processedProjectData: Buffer;
    try {
      // Читаем оригинальный ZIP
      const originalZip = new AdmZip(originalProjectData);
      const entries = originalZip.getEntries();
      
      console.log(`📂 [DOWNLOAD] Original ZIP contains ${entries.length} entries`);
      
      // Определяем имя корневой папки из GitHub (обычно первая папка)
      let originalRootFolder = "";
      const firstEntry = entries.find(entry => entry.isDirectory);
      if (firstEntry) {
        originalRootFolder = firstEntry.entryName.replace(/\/$/, ''); // убираем trailing slash
        console.log(`📁 [DOWNLOAD] Original root folder: "${originalRootFolder}"`);
      }
      
      // Создаем новый ZIP с переименованной папкой
      const newZip = new AdmZip();
      
      // Улучшенная обработка имени папки - поддержка кириллицы и других Unicode символов
      let newRootFolder = project.name.trim();
      
      // Заменяем только опасные символы для файловой системы, оставляя Unicode
      newRootFolder = newRootFolder
        .replace(/[<>:"/\\|?*]/g, '-')  // Опасные символы для файловой системы
        .replace(/\s+/g, '-')          // Пробелы на дефисы
        .replace(/^\.+|\.+$/g, '')     // Убираем точки в начале и конце
        .replace(/-+/g, '-')           // Множественные дефисы в один
        .replace(/^-+|-+$/g, '');      // Убираем дефисы в начале и конце
      
      // Если после обработки имя пустое, используем fallback
      if (!newRootFolder) {
        newRootFolder = 'project';
      }
      
      console.log(`📁 [DOWNLOAD] Renaming root folder: "${originalRootFolder}" → "${newRootFolder}"`);
      
      let processedEntries = 0;
      entries.forEach(entry => {
        let newPath = entry.entryName;
        
        // Если есть корневая папка, заменяем её
        if (originalRootFolder && entry.entryName.startsWith(originalRootFolder)) {
          newPath = entry.entryName.replace(originalRootFolder, newRootFolder);
        }
        
        // Добавляем файл или папку в новый ZIP
        if (entry.isDirectory) {
          newZip.addFile(newPath, Buffer.alloc(0));
        } else {
          newZip.addFile(newPath, entry.getData());
        }
        
        processedEntries++;
        
        // Логируем прогресс каждые 100 файлов
        if (processedEntries % 100 === 0 || processedEntries === entries.length) {
          console.log(`🔄 [DOWNLOAD] Processed ${processedEntries}/${entries.length} entries`);
        }
      });
      
      processedProjectData = newZip.toBuffer();
      const processingTime = Date.now() - processingStartTime;
      console.log(`✅ [DOWNLOAD] ZIP processing completed in ${processingTime}ms, new size: ${processedProjectData.length} bytes`);
      
    } catch (processingError) {
      console.error(`❌ [DOWNLOAD] ZIP processing failed for project ${projectId}:`, processingError);
      
      // В случае ошибки обработки возвращаем оригинальный файл
      console.log(`⚠️ [DOWNLOAD] Falling back to original ZIP for project ${projectId}`);
      processedProjectData = originalProjectData;
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎉 [DOWNLOAD] Successfully completed download for ${projectId} in ${totalTime}ms`);

    // Возвращаем обработанный файл как blob - используем Buffer напрямую
    
    // Создаем безопасное имя файла для скачивания
    const safeFileName = project.name
      .replace(/[<>:"/\\|?*]/g, '-')  // Опасные символы для файловой системы
      .replace(/\s+/g, '-')          // Пробелы на дефисы
      .replace(/-+/g, '-')           // Множественные дефисы в один
      .replace(/^-+|-+$/g, '')       // Убираем дефисы в начале и конце
      .trim() || 'project';          // Fallback если имя пустое
    
    return new NextResponse(processedProjectData, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeFileName}-${projectId}.zip"`,
        "Content-Length": processedProjectData.length.toString(),
      },
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [DOWNLOAD] Fatal error for project ${projectId || 'unknown'} after ${totalTime}ms:`, error);
    return NextResponse.json(
      { error: "Failed to download project", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 