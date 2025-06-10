import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@shipvibes/database";
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
    
    let projectData: Buffer;
    try {
      projectData = await githubAppService.downloadRepositoryZip(project.github_repo_name, 'main');
      const downloadTime = Date.now() - downloadStartTime;
      console.log(`✅ [DOWNLOAD] GitHub download completed in ${downloadTime}ms, size: ${projectData?.length || 0} bytes`);
    } catch (downloadError) {
      console.error(`❌ [DOWNLOAD] GitHub download failed for project ${projectId}:`, downloadError);
      return NextResponse.json(
        { error: "Failed to download project from GitHub" },
        { status: 500 }
      );
    }
    
    if (!projectData || projectData.length === 0) {
      console.log(`❌ [DOWNLOAD] Empty or invalid project data from GitHub for ${projectId}`);
      return NextResponse.json(
        { error: "Project template is empty or corrupted" },
        { status: 404 }
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎉 [DOWNLOAD] Successfully completed GitHub download for ${projectId} in ${totalTime}ms`);

    // Возвращаем файл как blob
    return new NextResponse(new Uint8Array(projectData), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.name}-${projectId}.zip"`,
        "Content-Length": projectData.length.toString(),
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