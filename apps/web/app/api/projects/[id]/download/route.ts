import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@shipvibes/database";
import { downloadProjectTemplate } from "@shipvibes/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProjectById(id);
    
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Скачиваем проект из R2
    console.log(`Attempting to download project template for ID: ${id}`);
    const projectData = await downloadProjectTemplate(id);
    console.log(`Downloaded project data size: ${projectData?.length || 0} bytes`);
    
    if (!projectData) {
      console.log(`Project template not found for ID: ${id}`);
      return NextResponse.json(
        { error: "Project template not found" },
        { status: 404 }
      );
    }

    // Возвращаем файл как blob
    return new NextResponse(new Uint8Array(projectData), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="project-${id}.zip"`,
      },
    });
  } catch (error) {
    console.error("Error downloading project:", error);
    return NextResponse.json(
      { error: "Failed to download project" },
      { status: 500 }
    );
  }
} 