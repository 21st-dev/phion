import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, ProjectQueries } from "@shipvibes/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    
    const project = await projectQueries.getProjectById(id);
    
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error getting project:", error);
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    
    const updatedProject = await projectQueries.updateProject(id, body);
    
    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const supabase = getSupabaseServerClient();
    const projectQueries = new ProjectQueries(supabase);
    
    await projectQueries.deleteProject(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
} 