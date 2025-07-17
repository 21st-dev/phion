import { NextRequest, NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { z } from "zod"
import { getSupabaseServerClient } from "@shipvibes/database"

interface WaitlistEntryWithAI {
  id: string
  email: string
  name: string
  coding_experience: string
  frustrations: string
  dream_project: string
  accepts_call: boolean | null
  status: string
  created_at: string
  ai_needs_reanalysis?: boolean | null
  ai_analyzed_at?: string | null
  ai_analysis_score?: number | null
  ai_analysis_summary?: string | null
  ai_analysis_reasoning?: string | null
  ai_deployment_issues?: boolean | null
  ai_versioning_issues?: boolean | null
  ai_openness_score?: number | null
  ai_experience_level?: string | null
  ai_uses_cursor?: boolean | null
}

const analysisSchema = z.object({
  overallScore: z.number().min(0).max(100).describe("Overall fit score from 0-100"),
  summary: z.string().describe("Brief summary of the candidate in 2-3 sentences"),
  reasoning: z.string().describe("Detailed reasoning for the score"),
  hasDeploymentIssues: z
    .boolean()
    .describe("True if they mention deployment, hosting, or infrastructure frustrations"),
  hasVersioningIssues: z
    .boolean()
    .describe("True if they mention git, version control, or code management issues"),
  opennessScore: z
    .number()
    .min(0)
    .max(10)
    .describe("Custom written responses vs standard selections (0-10)"),
  keySignals: z.array(z.string()).describe("Key positive or negative signals from their responses"),
  experienceLevel: z
    .enum(["beginner", "intermediate", "senior"])
    .describe("Coding experience level"),
  usesCursor: z.boolean().describe("True if they mention using Cursor IDE"),
})

export async function POST(request: NextRequest) {
  try {
    const { entryId } = await request.json()

    if (!entryId) {
      return NextResponse.json({ error: "Entry ID is required" }, { status: 400 })
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

    const typedEntry = entry as any as WaitlistEntryWithAI

    // Check, 
    if (!typedEntry.ai_needs_reanalysis && typedEntry.ai_analyzed_at) {
      return NextResponse.json({
        message: "Already analyzed",
        analysis: {
          score: typedEntry.ai_analysis_score,
          summary: typedEntry.ai_analysis_summary,
          reasoning: typedEntry.ai_analysis_reasoning,
          deploymentIssues: typedEntry.ai_deployment_issues,
          versioningIssues: typedEntry.ai_versioning_issues,
          opennessScore: typedEntry.ai_openness_score,
          experienceLevel: typedEntry.ai_experience_level,
          usesCursor: typedEntry.ai_uses_cursor,
        },
      })
    }

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: analysisSchema,
      prompt: `
Analyze this waitlist application for Phion, a product that helps developers deploy and iterate on projects faster.

SCORING CRITERIA (0-100):

POSITIVE INDICATORS (increase score):
- Deployment/hosting struggles and infrastructure issues
- Git/version control pain points and workflow inefficiencies  
- BEGINNERS/INTERMEDIATE developers (they need help most!)
- Users who mention using Cursor IDE (especially beginners - shows they're adopting new tools)
- Custom written frustrations vs selecting standard options
- Specific examples of real problems they face

NEGATIVE INDICATORS (decrease score):
- SENIOR developers with many years of experience (they likely don't need this tool)
- Only generic/standard frustration selections without custom details
- Irrelevant use cases or problems we can't solve
- No deployment or workflow issues mentioned

STANDARD FRUSTRATIONS TO IDENTIFY (these are clickable options, not custom responses):
- "Environment setup and configuration"
- "Dependency management and version conflicts"
- "Debugging and error messages" 
- "Learning curve and complexity"
- "Context switching between tools"

OPENNESS SCORING:
- High (7-10): Custom written detailed responses, specific examples, personal experiences
- Medium (4-6): Mix of standard selections with some custom additions
- Low (0-3): Mostly/only standard frustration selections without elaboration

User Information:
Name: ${typedEntry.name}
Email: ${typedEntry.email}
Coding Experience: ${typedEntry.coding_experience}
Current Frustrations: ${typedEntry.frustrations}
Dream Project: ${typedEntry.dream_project}
Accepts Call: ${typedEntry.accepts_call ? "Yes" : "No"}

Analyze their experience level, check for Cursor IDE usage, identify if frustrations are custom or standard, and score their overall fit.
      `,
    })

    const { error: updateError } = await supabase
      .from("waitlist")
      .update({
        ai_analysis_score: result.object.overallScore,
        ai_analysis_summary: result.object.summary,
        ai_analysis_reasoning: result.object.reasoning,
        ai_deployment_issues: result.object.hasDeploymentIssues,
        ai_versioning_issues: result.object.hasVersioningIssues,
        ai_openness_score: result.object.opennessScore,
        ai_experience_level: result.object.experienceLevel,
        ai_uses_cursor: result.object.usesCursor,
        ai_analyzed_at: new Date().toISOString(),
        ai_needs_reanalysis: false,
      } as any)
      .eq("id", entryId)

    if (updateError) {
      console.error("Error updating analysis:", updateError)
      return NextResponse.json({ error: "Failed to save analysis" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      analysis: {
        score: result.object.overallScore,
        summary: result.object.summary,
        reasoning: result.object.reasoning,
        deploymentIssues: result.object.hasDeploymentIssues,
        versioningIssues: result.object.hasVersioningIssues,
        opennessScore: result.object.opennessScore,
        experienceLevel: result.object.experienceLevel,
        usesCursor: result.object.usesCursor,
        keySignals: result.object.keySignals,
      },
    })
  } catch (error) {
    console.error("Error analyzing entry:", error)
    return NextResponse.json(
      {
        error: "Failed to analyze entry",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Bulk analyze endpoint
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    // Get , 
    const { data: entries, error: fetchError } = await supabase
      .from("waitlist")
      .select("*")
      .eq("ai_needs_reanalysis", true)

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 })
    }

    const results = []

    for (const entry of entries || []) {
      try {
        const typedEntry = entry as any as WaitlistEntryWithAI

        const result = await generateObject({
          model: openai("gpt-4o"),
          schema: analysisSchema,
          prompt: `
Analyze this waitlist application for Phion, a product that helps developers deploy and iterate on projects faster.

SCORING CRITERIA (0-100):

POSITIVE INDICATORS (increase score):
- Deployment/hosting struggles and infrastructure issues
- Git/version control pain points and workflow inefficiencies  
- BEGINNERS/INTERMEDIATE developers (they need help most!)
- Users who mention using Cursor IDE (especially beginners - shows they're adopting new tools)
- Custom written frustrations vs selecting standard options
- Specific examples of real problems they face

NEGATIVE INDICATORS (decrease score):
- SENIOR developers with many years of experience (they likely don't need this tool)
- Only generic/standard frustration selections without custom details
- No deployment or workflow issues mentioned

STANDARD FRUSTRATIONS TO IDENTIFY (these are clickable options, not custom responses):
- "Environment setup and configuration"
- "Dependency management and version conflicts"
- "Debugging and error messages" 
- "Learning curve and complexity"
- "Context switching between tools"

OPENNESS SCORING:
- High (7-10): Custom written detailed responses, specific examples, personal experiences
- Medium (4-6): Mix of standard selections with some custom additions
- Low (0-3): Mostly/only standard frustration selections without elaboration

User Information:
Name: ${typedEntry.name}
Email: ${typedEntry.email}
Coding Experience: ${typedEntry.coding_experience}
Current Frustrations: ${typedEntry.frustrations}
Dream Project: ${typedEntry.dream_project}
Accepts Call: ${typedEntry.accepts_call ? "Yes" : "No"}

Analyze their experience level, check for Cursor IDE usage, identify if frustrations are custom or standard, and score their overall fit.
          `,
        })

        await supabase
          .from("waitlist")
          .update({
            ai_analysis_score: result.object.overallScore,
            ai_analysis_summary: result.object.summary,
            ai_analysis_reasoning: result.object.reasoning,
            ai_deployment_issues: result.object.hasDeploymentIssues,
            ai_versioning_issues: result.object.hasVersioningIssues,
            ai_openness_score: result.object.opennessScore,
            ai_experience_level: result.object.experienceLevel,
            ai_uses_cursor: result.object.usesCursor,
            ai_analyzed_at: new Date().toISOString(),
            ai_needs_reanalysis: false,
          } as any)
          .eq("id", typedEntry.id)

        results.push({
          id: typedEntry.id,
          score: result.object.overallScore,
          success: true,
        })
      } catch (error) {
        console.error(`Error analyzing entry ${entry.id}:`, error)
        results.push({
          id: entry.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error("Error in bulk analysis:", error)
    return NextResponse.json(
      {
        error: "Failed to perform bulk analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
