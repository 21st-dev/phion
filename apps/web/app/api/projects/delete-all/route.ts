import { NextRequest, NextResponse } from "next/server"
import { createAuthServerClient, ProjectQueries } from "@shipvibes/database"
import { cookies } from "next/headers"
import { githubAppService } from "@/lib/github-service"

/**
 * Удалить Netlify сайт через API
 */
async function deleteNetlifySite(siteId: string): Promise<void> {
  const netlifyToken = process.env.NETLIFY_ACCESS_TOKEN

  if (!netlifyToken) {
    throw new Error("NETLIFY_ACCESS_TOKEN not configured")
  }

  const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${netlifyToken}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to delete Netlify site: ${response.status} ${errorText}`)
  }
}

async function getAuthenticatedUser(_request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createAuthServerClient({
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      } catch {
        // Игнорируем ошибки установки cookies
      }
    },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { user: null, supabase: null, error: "Unauthorized" }
  }

  return { user, supabase, error: null }
}

export async function DELETE(request: NextRequest) {
  try {
    // Проверяем, что это dev environment
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { error: "This endpoint is only available in development environment" },
        { status: 403 },
      )
    }

    const { user, supabase, error } = await getAuthenticatedUser(request)
    if (error || !supabase) {
      return NextResponse.json({ error }, { status: 401 })
    }

    const projectQueries = new ProjectQueries(supabase)

    // Получаем все проекты пользователя
    const { data: projects, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)

    if (fetchError) {
      console.error("Error fetching projects:", fetchError)
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No projects to delete",
        deletedCount: 0,
      })
    }

    console.log(`🗑️ [DEV] Deleting all ${projects.length} projects for user ${user.id}`)

    let deletedCount = 0
    let errors: string[] = []

    // Удаляем каждый проект
    for (const project of projects) {
      try {
        console.log(`🗑️ [DEV] Deleting project ${project.id}: ${project.name}`)

        // Если у проекта есть Netlify сайт, удаляем его
        if (project.netlify_site_id) {
          try {
            console.log(`🌐 [DEV] Deleting Netlify site: ${project.netlify_site_id}`)
            await deleteNetlifySite(project.netlify_site_id)
            console.log(`✅ [DEV] Netlify site deleted successfully: ${project.netlify_site_id}`)
          } catch (netlifyError) {
            console.error(
              `❌ [DEV] Error deleting Netlify site ${project.netlify_site_id}:`,
              netlifyError,
            )
            errors.push(`Failed to delete Netlify site for project ${project.name}`)
          }
        }

        // Если у проекта есть GitHub репозиторий, удаляем его
        if (project.github_repo_name) {
          try {
            console.log(`🐙 [DEV] Deleting GitHub repository: ${project.github_repo_name}`)
            await githubAppService.deleteRepository(project.github_repo_name)
            console.log(
              `✅ [DEV] GitHub repository deleted successfully: ${project.github_repo_name}`,
            )
          } catch (githubError) {
            console.error(
              `❌ [DEV] Error deleting GitHub repository ${project.github_repo_name}:`,
              githubError,
            )
            errors.push(`Failed to delete GitHub repository for project ${project.name}`)
          }
        }

        // Удаляем проект из базы данных
        console.log(`🗄️ [DEV] Deleting project from database: ${project.id}`)
        await projectQueries.deleteProject(project.id)
        console.log(`✅ [DEV] Project deleted successfully: ${project.id}`)

        deletedCount++
      } catch (projectError) {
        console.error(`❌ [DEV] Error deleting project ${project.id}:`, projectError)
        errors.push(
          `Failed to delete project ${project.name}: ${projectError instanceof Error ? projectError.message : "Unknown error"}`,
        )
      }
    }

    const response = {
      success: true,
      deletedCount,
      totalProjects: projects.length,
      message: `Successfully deleted ${deletedCount} out of ${projects.length} projects`,
      errors: errors.length > 0 ? errors : undefined,
    }

    console.log(`🎉 [DEV] Delete all projects completed:`, response)

    return NextResponse.json(response)
  } catch (error) {
    console.error("❌ [DEV] Error in delete all projects:", error)
    return NextResponse.json({ error: "Failed to delete projects" }, { status: 500 })
  }
}
