import { createAuthServerClient } from "@shipvibes/database"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: ".env.local" })
}

interface SubscriptionResponse {
  success: boolean
  exists: boolean
  hasActiveSubscription: boolean
  email: string
  userId?: string
  username?: string
  planType?: string
  planPrice?: number
  planPeriod?: string
  subscriptionStatus?: string
  lastPaidAt?: string
  subscriptionEndDate?: string
  isExpired?: boolean
  metadata?: {
    createdAt?: string
    isAdmin?: boolean
    isPartner?: boolean
    stripeId?: string
  }
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
          // Ignore errors setting cookies
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

    const email = user.email
    if (!email) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 })
    }

    // Check  21st.dev API
    const subscriptionApiKey = process.env.SUBSCRIPTION_API_KEY

    const isDevelopment = process.env.NODE_ENV === "development"

    if (!subscriptionApiKey) {
      console.error("SUBSCRIPTION_API_KEY not configured")
      return NextResponse.json({
        hasActiveSubscription: false,
        email,
        error: "Subscription service not configured",
        hint: isDevelopment
          ? "Add SKIP_SUBSCRIPTION_CHECK=true to .env.local for development"
          : undefined,
      })
    }

    try {
      // Add timeout and better error handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const subscriptionResponse = await fetch(
        `${process.env.NEXT_PUBLIC_21ST_URL}/api/subscription/check`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey: subscriptionApiKey,
            email: email,
          }),
          signal: controller.signal,
        },
      )

      clearTimeout(timeoutId)

      if (!subscriptionResponse.ok) {
        console.error(
          "Failed to check subscription:",
          subscriptionResponse.status,
          subscriptionResponse.statusText,
        )
        return NextResponse.json({
          hasActiveSubscription: false,
          email,
          error: "Subscription check failed",
        })
      }

      // Check if response is JSON before parsing
      const contentType = subscriptionResponse.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        // Log what we actually received for debugging
        const responseText = await subscriptionResponse.text()
        console.error("Subscription API returned non-JSON response:", {
          status: subscriptionResponse.status,
          statusText: subscriptionResponse.statusText,
          contentType,
          responseBody: responseText.substring(0, 500) + (responseText.length > 500 ? "..." : ""), // First 500 chars
          url: `${process.env.NEXT_PUBLIC_21ST_URL}/api/subscription/check`,
        })

        return NextResponse.json({
          hasActiveSubscription: false,
          email,
          error: "Invalid response from subscription service",
          debug: {
            status: subscriptionResponse.status,
            contentType,
            responsePreview: responseText.substring(0, 200),
          },
        })
      }

      const subscriptionData: SubscriptionResponse = await subscriptionResponse.json()
      return NextResponse.json(subscriptionData)
    } catch (fetchError) {
      // Handle specific fetch errors
      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          console.error("Subscription check timed out")
          return NextResponse.json({
            hasActiveSubscription: false,
            email,
            error: "Subscription check timed out",
          })
        }
        console.error("Subscription check fetch error:", fetchError.message)
      }

      // Return graceful fallback for subscription check failures
      return NextResponse.json({
        hasActiveSubscription: false,
        email,
        error: "Unable to verify subscription status",
      })
    }
  } catch (error) {
    console.error("Error checking subscription:", error)
    return NextResponse.json(
      {
        hasActiveSubscription: false,
        error: "Failed to check subscription",
      },
      { status: 500 },
    )
  }
}
