import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient, ProjectQueries } from "@shipvibes/database";
import { cookies } from "next/headers";

async function getAuthenticatedUser(request: NextRequest) {
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
    return { user: null, supabase: null, error: "Unauthorized" };
  }

  return { user, supabase, error: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { user, supabase, error } = await getAuthenticatedUser(request);
    if (error || !supabase) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const projectQueries = new ProjectQueries(supabase);
    
    // RLS автоматически проверит, что пользователь имеет доступ к проекту
    const project = await projectQueries.getProjectById(id);
    
    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
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
    
    const { user, supabase, error } = await getAuthenticatedUser(request);
    if (error || !supabase) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const projectQueries = new ProjectQueries(supabase);
    
    // RLS автоматически проверит, что пользователь может обновить проект
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
    
    const { user, supabase, error } = await getAuthenticatedUser(request);
    if (error || !supabase) {
      return NextResponse.json({ error }, { status: 401 });
    }

    const projectQueries = new ProjectQueries(supabase);
    
    // RLS автоматически проверит, что пользователь может удалить проект
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