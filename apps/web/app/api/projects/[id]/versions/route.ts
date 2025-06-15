import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient, FileHistoryQueries } from "@shipvibes/database"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params

    const supabase = getSupabaseServerClient()
    const queries = new FileHistoryQueries(supabase)

    const history = await queries.getProjectFileHistory(projectId, 200)

    return NextResponse.json(history)
  } catch (error) {
    console.error("Error fetching history:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
