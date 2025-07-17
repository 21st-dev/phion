import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { getSupabaseServerClient } from "@shipvibes/database"
import { ApprovalEmail } from "@/components/emails/approval-email"

const resend = new Resend(process.env.RESEND_API_KEY)

// Mock  -  email
const MOCK_MODE = false
const MOCK_EMAIL = "serafimcloud@gmail.com"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const entryId = id

    if (!entryId) {
      return NextResponse.json({ error: "Entry ID is required" }, { status: 400 })
    }

    // Check  Resend API 
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          error: "Resend API key not configured",
          details: "Please add RESEND_API_KEY to your environment variables",
        },
        { status: 500 },
      )
    }

    const supabase = getSupabaseServerClient()

    // Get user data
    const { data: entry, error: fetchError } = await supabase
      .from("waitlist")
      .select("*")
      .eq("id", entryId)
      .single()

    if (fetchError || !entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 })
    }

    // Check,  approved
    if (entry.status !== "approved") {
      return NextResponse.json(
        {
          error: "User is not approved",
          status: entry.status,
        },
        { status: 400 },
      )
    }

    const recipientEmail = MOCK_MODE ? MOCK_EMAIL : entry.email
    const recipientName = MOCK_MODE ? `${entry.name} (MOCK TEST)` : entry.name

    console.log(`Sending approval email to: ${recipientEmail} (Original: ${entry.email})`)

    // Send email  Resend
    const { data, error } = await resend.emails.send({
      from: "Serafim from Phion <onboarding@hey.phion.dev>",
      replyTo: "serafim@21st.dev",
      to: [recipientEmail],
      subject: "Welcome to Phion Beta - You're Approved!",
      react: ApprovalEmail({
        name: recipientName,
        discordInvite: "https://discord.gg/j4ZMYnMeJN",
      }),
    })

    if (error) {
      console.error("Resend error:", error)
      return NextResponse.json(
        {
          error: "Failed to send email",
          details: error.message || "Unknown Resend error",
        },
        { status: 500 },
      )
    }

    console.log("Email sent successfully:", data)

    const { error: updateError } = await supabase
      .from("waitlist")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", entryId)

    if (updateError) {
      console.error("Error updating entry after email:", updateError)
    }

    return NextResponse.json({
      success: true,
      emailId: data?.id,
      message: `Approval email sent to ${recipientEmail}`,
      mockMode: MOCK_MODE,
      originalEmail: entry.email,
    })
  } catch (error) {
    console.error("Error sending approval email:", error)
    return NextResponse.json(
      {
        error: "Failed to send approval email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
