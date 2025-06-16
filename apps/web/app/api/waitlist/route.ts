import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@shipvibes/database"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      name,
      codingExperience,
      frustrations,
      toolsUsed,
      toolDislike,
      dreamProject,
      acceptsCall,
    } = body

    // Basic validation
    if (!email || !name || !codingExperience || !frustrations || !toolsUsed || !dreamProject) {
      return NextResponse.json({ error: "All required fields must be filled out" }, { status: 400 })
    }

    // Validate frustrations structure
    if (
      (!frustrations.selectedOptions || frustrations.selectedOptions.length === 0) &&
      (!frustrations.customText || !frustrations.customText.trim())
    ) {
      return NextResponse.json(
        {
          error: "Please select at least one frustration or describe your own",
        },
        { status: 400 },
      )
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Please provide a valid email address" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Check if email already exists
    const { data: existingEntry } = await supabase
      .from("waitlist")
      .select("email")
      .eq("email", email)
      .single()

    if (existingEntry) {
      return NextResponse.json(
        { error: "This email address is already on our waitlist" },
        { status: 409 },
      )
    }

    // Validate custom text length
    if (frustrations.customText && frustrations.customText.length > 500) {
      return NextResponse.json(
        { error: "Custom frustration description must be 500 characters or less" },
        { status: 400 },
      )
    }

    // Validate tool dislike (required if user selected a tool, not required if "none")
    if (toolsUsed !== "none" && !toolDislike.trim()) {
      return NextResponse.json(
        { error: "Please tell us what you didn't like about the tool" },
        { status: 400 },
      )
    }

    // Validate tool dislike length
    if (toolDislike && toolDislike.length > 500) {
      return NextResponse.json(
        { error: "Tool feedback must be 500 characters or less" },
        { status: 400 },
      )
    }

    // Format frustrations for database storage
    const frustrationsText = [
      ...(frustrations.selectedOptions || []),
      ...(frustrations.customText ? [`Custom: ${frustrations.customText}`] : []),
    ].join("; ")

    // Insert the waitlist entry
    const { data, error } = await supabase
      .from("waitlist")
      .insert({
        email,
        name,
        coding_experience: codingExperience,
        frustrations: frustrationsText,
        tools_used: toolsUsed,
        tool_dislike: toolsUsed === "none" ? null : toolDislike,
        dream_project: dreamProject,
        accepts_call: acceptsCall,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json(
        { error: "Failed to submit application. Please try again." },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "Application submitted successfully!",
        data,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
