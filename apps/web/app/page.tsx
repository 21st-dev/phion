"use client"

import { Logo } from "@/components/brand"
import { Button } from "@/components/geist/button"
import { useToast } from "@/hooks/use-toast"
import { createAuthBrowserClient } from "@shipvibes/database"
import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/geist/spinner"
import { CheckCircle, Clock, AlertCircle } from "lucide-react"

interface WaitlistEntry {
  id: string
  email: string
  status?: string // Optional for legacy entries
  created_at: string
}

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(false) // Default to waitlist mode
  const [user, setUser] = useState<any>(null)
  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntry | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const supabase = createAuthBrowserClient()
  const { error: showError } = useToast()
  const router = useRouter()

  useEffect(() => {
    checkUserStatus()
  }, [])

  const checkUserStatus = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)

      if (user && user.email) {
        console.log("🔍 Checking waitlist for user:", user.email)

        // First, let's see what's in the table structure
        const { data: sampleData, error: sampleError } = await supabase
          .from("waitlist")
          .select("*")
          .limit(1)

        console.log("🔍 Table sample:", {
          data: sampleData,
          error: sampleError,
          keys: sampleData?.[0] ? Object.keys(sampleData[0]) : null,
        })

        // Check waitlist status - use maybeSingle to handle missing records gracefully
        const { data: waitlistData, error } = await supabase
          .from("waitlist")
          .select("*")
          .eq("email", user.email)
          .maybeSingle()

        console.log("📊 Waitlist query result:", {
          data: waitlistData,
          error: error,
          hasData: !!waitlistData,
          dataKeys: waitlistData ? Object.keys(waitlistData) : null,
        })

        if (!error && waitlistData) {
          console.log("✅ Found waitlist entry:", waitlistData)
          console.log("🎯 Status field:", {
            value: waitlistData.status,
            type: typeof waitlistData.status,
            hasStatusField: "status" in waitlistData,
          })

          // Add default status if missing (for legacy entries)
          const entryWithStatus = {
            ...waitlistData,
            status: waitlistData.status || "pending",
          }
          console.log("🔄 Final entry:", entryWithStatus)
          setWaitlistEntry(entryWithStatus)
        } else if (error) {
          console.log("❌ Waitlist query error:", error.message, error.code)
          console.error("❌ Full error:", error)
        } else {
          console.log("⚠️ No waitlist entry found for user")
        }
      }
    } catch (error) {
      console.error("Error checking user status:", error)
    } finally {
      setCheckingStatus(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error("Error during Google login:", error.message)
        showError("Login failed", error.message)
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      showError("Login failed", "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGitHubLogin = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error("Error during GitHub login:", error.message)
        showError("Login failed", error.message)
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      showError("Login failed", "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinWaitlist = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/waitlist`,
        },
      })

      if (error) {
        console.error("Error during Google login:", error.message)
        showError("Login failed", error.message)
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      showError("Login failed", "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const getWaitlistStatus = () => {
    if (!waitlistEntry) {
      return {
        icon: <AlertCircle className="w-5 h-5" />,
        title: "Complete Your Application",
        description: "You need to complete your waitlist application to get early access.",
        buttonText: "Complete Application",
        buttonAction: () => router.push("/waitlist"),
        variant: "warning" as const,
      }
    }

    const status = waitlistEntry.status || "pending"

    switch (status) {
      case "approved":
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          title: "Welcome to Phion!",
          description: "Your application has been approved. Redirecting to your dashboard...",
          buttonText: "Go to Dashboard",
          buttonAction: () => router.push(`/${user.id}`),
          variant: "success" as const,
        }
      case "rejected":
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          title: "Application Not Approved",
          description:
            "Unfortunately, your application was not approved at this time. Please check back later.",
          buttonText: "Contact Support",
          buttonAction: () => window.open("mailto:support@phion.dev", "_blank"),
          variant: "error" as const,
        }
      default: // pending
        return {
          icon: <Clock className="w-5 h-5" />,
          title: "You're already on the waitlist",
          description: "We'll notify you once approved.",
          buttonText: null, // No button for pending users
          buttonAction: null,
          variant: "pending" as const,
        }
    }
  }

  if (checkingStatus) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 relative bg-cover bg-center bg-no-repeat"
      >
        <div className="relative z-10 flex flex-col items-center">
          <Spinner size={32} />
          <p className="mt-4 text-sm text-white/80">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative bg-black"
    >
      {/* Login/Waitlist Toggle Button - только для неавторизованных */}
      {!user && (
        <button
          onClick={() => setIsLoginMode(!isLoginMode)}
          className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors text-sm font-medium"
        >
          {isLoginMode ? "← Join Waitlist" : "Login"}
        </button>
      )}

      {/* Main content */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="space-y-16">
          {/* Main Message */}
          <div className="text-center space-y-8 flex flex-col items-center">
            <h1 className="text-4xl font-extralight text-white tracking-tight leading-tight flex items-center gap-2">
              <Logo width={30} height={30} forceDark /> Phion
            </h1>

            <p className="text-lg font-light text-white/80 leading-relaxed">
              Just craft in Cursor.
              <br />
              We handle everything else.
            </p>
          </div>

          {/* Content */}
          {!user ? (
            // Неавторизованный пользователь
            <>
              {isLoginMode ? (
                // Login Mode
                <div className="text-center space-y-6 max-w-[250px] mx-auto">
                  <div className="flex flex-col gap-2">
                    <Button
                      type="secondary"
                      size="small"
                      onClick={handleGoogleLogin}
                      className="w-full hover:bg-white/80 hover:text-black"
                      prefix={
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                      }
                    >
                      Continue with Google
                    </Button>

                    <Button
                      type="tertiary"
                      size="small"
                      onClick={handleGitHubLogin}
                      className="w-full  bg-white/0 hover:bg-white/10 text-white hover:text-white"
                      prefix={
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                      }
                    >
                      Continue with GitHub
                    </Button>
                  </div>

                  <p className="text-xs font-light text-white/60">
                    By continuing, you agree to our terms
                  </p>
                </div>
              ) : (
                // Waitlist Mode
                <div className="text-center space-y-6 max-w-[250px] mx-auto">
                  <Button
                      type="secondary"
                      size="small"
                    onClick={handleJoinWaitlist}
                    className="w-full"
                    prefix={
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    }
                  >
                    Join Waitlist
                  </Button>

                  <p className="text-xs font-light text-white/60">
                    Be among the first to experience the future of development
                  </p>
                </div>
              )}
            </>
          ) : (
            // Авторизованный пользователь - показываем статус waitlist
            (() => {
              const statusInfo = getWaitlistStatus()

              // For pending users, show simple message without card
              if (statusInfo.variant === "pending") {
                return (
                  <div className="text-center space-y-6">
                    <p className="text-lg font-light text-white/80 leading-relaxed">
                      You're already on the waitlist.
                    </p>

                    <button
                      onClick={async () => {
                        await supabase.auth.signOut()
                        setUser(null)
                        setWaitlistEntry(null)
                      }}
                      className="text-xs text-white/60 hover:text-white/80 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )
              }

              // For other statuses (approved, rejected), keep the card
              return (
                <div className="text-center space-y-6">
                  <div
                    className={`p-6 rounded-lg border backdrop-blur-sm ${
                      statusInfo.variant === "success"
                        ? "bg-green-500/20 border-green-500/30"
                        : statusInfo.variant === "error"
                        ? "bg-red-500/20 border-red-500/30"
                        : statusInfo.variant === "warning"
                        ? "bg-orange-500/20 border-orange-500/30"
                        : "bg-blue-500/20 border-blue-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div
                        className={`${
                          statusInfo.variant === "success"
                            ? "text-green-300"
                            : statusInfo.variant === "error"
                            ? "text-red-300"
                            : statusInfo.variant === "warning"
                            ? "text-orange-300"
                            : "text-blue-300"
                        }`}
                      >
                        {statusInfo.icon}
                      </div>
                      <h2 className="text-lg font-medium text-white">{statusInfo.title}</h2>
                    </div>
                    <p className="text-sm text-white/80 mb-6">{statusInfo.description}</p>

                    {statusInfo.buttonText && (
                      <Button
                        type={
                          statusInfo.variant === "success"
                            ? "primary"
                            : statusInfo.variant === "error"
                            ? "error"
                            : statusInfo.variant === "warning"
                            ? "warning"
                            : "primary"
                        }
                        onClick={statusInfo.buttonAction}
                      >
                        {statusInfo.buttonText}
                      </Button>
                    )}
                  </div>

                  <button
                    onClick={async () => {
                      await supabase.auth.signOut()
                      setUser(null)
                      setWaitlistEntry(null)
                    }}
                    className="text-xs text-white/60 hover:text-white/80 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )
            })()
          )}
        </div>
      </div>
    </div>
  )
}
