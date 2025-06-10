import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@shipvibes/database";
import { downloadProjectTemplate } from "@shipvibes/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let projectId: string | undefined;
  
  try {
    const { id } = await params;
    projectId = id;
    
    console.log(`🔄 [DOWNLOAD] Starting download for project ${projectId}`);
    
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

    // Скачиваем проект из R2
    console.log(`⬇️ [DOWNLOAD] Downloading template from R2 for project ${projectId}`);
    const downloadStartTime = Date.now();
    
    let projectData: Buffer;
    try {
      projectData = await downloadProjectTemplate(projectId);
      const downloadTime = Date.now() - downloadStartTime;
      console.log(`✅ [DOWNLOAD] R2 download completed in ${downloadTime}ms, size: ${projectData?.length || 0} bytes`);
    } catch (downloadError) {
      console.error(`❌ [DOWNLOAD] R2 download failed for project ${projectId}:`, downloadError);
      return NextResponse.json(
        { error: "Project template not found in storage" },
        { status: 404 }
      );
    }
    
    if (!projectData || projectData.length === 0) {
      console.log(`❌ [DOWNLOAD] Empty or invalid project data for ${projectId}`);
      return NextResponse.json(
        { error: "Project template is empty or corrupted" },
        { status: 404 }
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎉 [DOWNLOAD] Successfully completed download for ${projectId} in ${totalTime}ms`);

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