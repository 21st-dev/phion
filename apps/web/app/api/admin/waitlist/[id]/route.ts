import { createAuthServerClient } from "@shipvibes/database"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !["pending", "approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'pending', 'approved', or 'rejected'" },
        { status: 400 },
      )
    }

    // Admin authentication is handled by middleware
    // Get user for approved_by field
    const cookieStore = await cookies()
    const supabase = createAuthServerClient({
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignore cookie setting errors in Server Components
        }
      },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "User session error" }, { status: 500 })
    }

    // Update waitlist entry
    const updateData = {
      status,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("waitlist")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating waitlist entry:", error)
      return NextResponse.json({ error: "Failed to update waitlist entry" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error("Error in waitlist update API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
