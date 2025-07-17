import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient, ProjectQueries } from "@shipvibes/database"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const supabase = getSupabaseServerClient()
    const projectQueries = new ProjectQueries(supabase)

    // Get project
    const project = await projectQueries.getProjectById(id)

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: project.id,
      deploy_status: project.deploy_status,
      netlify_url: project.netlify_url,
      netlify_site_id: project.netlify_site_id,
      netlify_deploy_id: project.netlify_deploy_id,
      updated_at: project.updated_at,
    })
  } catch (error) {
    console.error("Error getting project status:", error)
    return NextResponse.json({ error: "Failed to get project status" }, { status: 500 })
  }
}
