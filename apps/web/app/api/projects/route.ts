import {
  createAuthServerClient,
  createProject,
  getSupabaseServerClient,
  getUserProjects,
  ProjectQueries,
} from "@shipvibes/database"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
// Project logger removed - using console.log instead

// Загружаем переменные окружения
if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: ".env.local" })
}

export async function GET(_request: NextRequest) {
  try {
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Получаем проекты пользователя (RLS автоматически фильтрует)
    const projects = await getUserProjects(user.id)
    return NextResponse.json(projects)
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, template_type } = body

    if (!name || !template_type) {
      return NextResponse.json({ error: "Name and template_type are required" }, { status: 400 })
    }

    // Проверяем лимиты проектов
    const email = user.email
    if (!email) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 })
    }

    // Проверяем текущее количество проектов пользователя
    const { data: existingProjects, error: countError } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)

    if (countError) {
      console.error("Error counting projects:", countError)
      return NextResponse.json({ error: "Failed to check project limits" }, { status: 500 })
    }

    const projectCount = existingProjects?.length || 0
    const FREE_TIER_LIMIT = 1

    // Проверяем подписку через 21st.dev API
    let hasActiveSubscription = false
    const subscriptionApiKey = process.env.SUBSCRIPTION_API_KEY

    if (subscriptionApiKey) {
      try {
        const subscriptionResponse = await fetch(
          `${process.env.NEXT_PUBLIC_21ST_URL}/api/subscription/check`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              apiKey: subscriptionApiKey,
            }),
          },
        )

        if (subscriptionResponse.ok) {
          const subscriptionData = await subscriptionResponse.json()
          hasActiveSubscription = subscriptionData?.hasActiveSubscription ?? false
          console.log(`🔍 Subscription check for ${email}:`, {
            status: subscriptionData.status,
            hasActiveSubscription,
          })
        } else {
          console.log(`⚠️ Subscription API returned ${subscriptionResponse.status} for ${email}`)
        }
      } catch (subscriptionError) {
        console.error("Error checking subscription:", subscriptionError)
        // Продолжаем без проверки подписки если API недоступен
      }
    }

    // Проверяем лимиты (отключено в dev окружении)
    if (
      process.env.NODE_ENV !== "development" &&
      !hasActiveSubscription &&
      projectCount >= FREE_TIER_LIMIT
    ) {
      return NextResponse.json(
        {
          error: "Project limit exceeded",
          message: `Free plan allows up to ${FREE_TIER_LIMIT} projects. Upgrade to Pro for unlimited projects.`,
          currentCount: projectCount,
          maxProjects: FREE_TIER_LIMIT,
        },
        { status: 403 },
      )
    }

    // ✅ 1. СРАЗУ создаем проект в БД (быстрая операция)
    const project = await createProject({
      name,
      template_type,
      user_id: user.id,
    })

    console.log(`🎉 Project created: ${project.id} by user ${user.id}`)

    // ✅ 2. НЕМЕДЛЕННО возвращаем ответ пользователю для быстрого redirect
    const response = NextResponse.json({
      projectId: project.id, // Add projectId for frontend compatibility
      project: {
        ...project,
        deploy_status: "pending", // Показываем что проект инициализируется
      },
      downloadUrl: `/api/projects/${project.id}/download`,
      status: "pending", // Клиент знает что проект инициализируется
      message: "Project created! Setting up GitHub repository and template files...",
    })

    // ✅ 3. Запускаем полную инициализацию через WebSocket сервер
    // WebSocket сервер обработает все в фоне - создание репо + шаблон
    await triggerCompleteInitialization(project.id, name, template_type, user.id)

    return response
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}

/**
 * ✅ Простая функция для запуска полной инициализации через WebSocket сервер
 * Все тяжелые операции выполняются на WebSocket сервере
 */
async function triggerCompleteInitialization(
  projectId: string,
  projectName: string,
  templateType: string,
  userId: string,
): Promise<void> {
  try {
    console.log(`🚀 [TRIGGER_INIT] Triggering complete initialization for ${projectId}...`)

    const websocketServerUrl = process.env.WEBSOCKET_SERVER_URL || "http://localhost:8080"

    const response = await fetch(`${websocketServerUrl}/api/projects/initialize-complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        projectName,
        templateType,
        userId,
      }),
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout - just for triggering
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to trigger initialization: ${errorText}`)
    }

    console.log(`✅ [TRIGGER_INIT] Complete initialization triggered for ${projectId}`)
  } catch (error) {
    console.error(`❌ [TRIGGER_INIT] Failed to trigger initialization for ${projectId}:`, error)

    // Update project status to failed if we can't even trigger the initialization
    try {
      const supabaseClient = getSupabaseServerClient()
      const projectQueries = new ProjectQueries(supabaseClient)
      await projectQueries.updateProject(projectId, {
        deploy_status: "failed",
      })
      console.log(`📊 Updated project ${projectId} status to failed (trigger failed)`)
    } catch (updateError) {
      console.error(`❌ Error updating project status for ${projectId}:`, updateError)
    }

    throw error
  }
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  context: string,
  maxAttempts = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation()
      if (attempt > 1) {
        console.log(`✅ [RETRY] ${context} succeeded on attempt ${attempt}`)
      }
      return result
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts) {
        console.error(
          `❌ [RETRY] ${context} failed after ${maxAttempts} attempts:`,
          lastError.message,
        )
        break
      }

      // Check if error is retryable
      const isRetryable = shouldRetryError(error)
      if (!isRetryable) {
        console.error(`❌ [RETRY] ${context} failed with non-retryable error:`, lastError.message)
        break
      }

      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
      console.log(
        `⚠️ [RETRY] ${context} attempt ${attempt} failed, retrying in ${Math.round(delay)}ms:`,
        lastError.message,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Determines if an error should trigger a retry
 */
function shouldRetryError(error: any): boolean {
  // Retry on server errors (5xx)
  if (error?.status >= 500) return true

  // Retry on rate limiting
  if (error?.status === 429) return true

  // Don't retry on client errors (4xx except 429)
  if (error?.status >= 400 && error?.status < 500) return false

  // Retry on network/timeout errors
  if (
    error?.code === "ENOTFOUND" ||
    error?.code === "ECONNRESET" ||
    error?.code === "ETIMEDOUT" ||
    error?.name === "AbortError" ||
    error?.message?.includes("fetch failed") ||
    error?.message?.includes("network") ||
    error?.message?.includes("timeout")
  ) {
    return true
  }

  return false
}

// ✅ Функции generateTemplateFiles, collectTemplateFiles и uploadTemplateFilesInBackground
// перенесены в WebSocket сервер для надежного выполнения в non-serverless окружении
