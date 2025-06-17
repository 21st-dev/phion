import { NextRequest, NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import { getSupabaseServerClient } from "@shipvibes/database"
import { PendingChangesQueries } from "@shipvibes/database"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()
    const pendingQueries = new PendingChangesQueries(supabase)

    // Получаем все pending changes для проекта
    const pendingChanges = await pendingQueries.getAllPendingChanges(projectId)

    if (pendingChanges.length === 0) {
      return NextResponse.json({ error: "No pending changes found" }, { status: 400 })
    }

    // Подготавливаем данные об изменениях для AI
    const changesInfo = pendingChanges.map((change) => ({
      file: change.file_path,
      action: change.action,
      // Берем первые 500 символов контента для анализа (чтобы не превысить лимиты API)
      contentPreview: change.content
        ? change.content.substring(0, 500) + (change.content.length > 500 ? "..." : "")
        : "",
    }))

    // Генерируем коммит сообщение с помощью AI
    const result = await generateText({
      model: openai("gpt-4o-mini"), // Используем более быструю и дешевую модель для коммит сообщений
      prompt: `
Generate a concise, descriptive commit message for these file changes in a React/TypeScript project.

Changes made:
${changesInfo
  .map(
    (change) =>
      `- ${change.action.toUpperCase()}: ${change.file}${change.contentPreview ? `\n  Preview: ${change.contentPreview}` : ""}`,
  )
  .join("\n")}

Rules for the commit message:
1. Use present tense (e.g., "Add", "Update", "Fix", "Remove")
2. Be specific about what was changed
3. Keep it under 72 characters for the main message
4. If multiple files, focus on the main purpose of the changes
5. Use action words like: Add, Update, Fix, Remove, Refactor, Implement
6. Examples of good messages:
   - "Add user authentication form"
   - "Update navbar styling and responsiveness" 
   - "Fix button hover states and colors"
   - "Implement shopping cart functionality"
   - "Refactor utility functions and types"

Generate only the commit message, nothing else.
      `,
    })

    const commitMessage = result.text.trim()

    // Проверяем, что сообщение не слишком длинное
    const finalMessage =
      commitMessage.length > 72 ? commitMessage.substring(0, 69) + "..." : commitMessage

    return NextResponse.json({
      success: true,
      commitMessage: finalMessage,
      changesCount: pendingChanges.length,
      files: changesInfo.map((c) => c.file),
    })
  } catch (error) {
    console.error("Error generating commit message:", error)

    // Возвращаем fallback сообщение если AI не сработал
    const fallbackMessage = "Update project files"

    return NextResponse.json({
      success: true,
      commitMessage: fallbackMessage,
      changesCount: 0,
      files: [],
      warning: "AI generation failed, using fallback message",
    })
  }
}
