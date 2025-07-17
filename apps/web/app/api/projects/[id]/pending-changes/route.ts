import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient, PendingChangesQueries } from "@shipvibes/database"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check  Supabase 
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use server client  pending_changes
    const serverSupabase = getSupabaseServerClient()
    const pendingQueries = new PendingChangesQueries(serverSupabase)

    const pendingChanges = await pendingQueries.getPendingChanges(id)

    return NextResponse.json({ pendingChanges })
  } catch (error) {
    console.error("Error fetching pending changes:", error)
    return NextResponse.json({ error: "Failed to fetch pending changes" }, { status: 500 })
  }
}
