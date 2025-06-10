import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, DeployStatusQueries } from "@shipvibes/database";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = cookies();
    const supabase = getSupabaseServerClient();
    
    // Проверяем аутентификацию
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const deployStatusQueries = new DeployStatusQueries(supabase);
    
    // Получаем статусы деплоев для проекта
    const deployStatuses = await deployStatusQueries.getProjectDeployStatuses(projectId, 20);
    
    return NextResponse.json({ deployStatuses });
  } catch (error) {
    console.error("Error getting deploy statuses:", error);
    return NextResponse.json(
      { error: "Failed to get deploy statuses" },
      { status: 500 }
    );
  }
} 