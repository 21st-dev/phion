"use client"

import { Logo } from "@/components/brand"
import { Button } from "@/components/geist/button"
import { Material } from "@/components/geist/material"
import { CursorDark } from "@/components/icons/cursor-dark"
import { CursorLight } from "@/components/icons/cursor-light"
import { SetupStep } from "@/components/project/setup/steps/setup-step"
import { useToast } from "@/hooks/use-toast"
import { useWebSocket } from "@/hooks/use-websocket"
import { ArrowRight, CheckCircle2, Download, X, Zap } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface FirstExperienceOnboardingProps {
  onComplete: () => void
}

export function FirstExperienceOnboarding({ onComplete }: FirstExperienceOnboardingProps) {
  const router = useRouter()
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState(0)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [hasCursor, setHasCursor] = useState<boolean | null>(null)
  const [agentConnected, setAgentConnected] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const { error: showError, success: showSuccess } = useToast()

  useWebSocket({
    projectId: projectId || undefined,
    onAgentConnected: (data) => {
      console.log("🟢 [Onboarding] Agent connected:", data)
      setAgentConnected(true)
      showSuccess("Agent connected! Your project is now syncing automatically")
    },
    onAgentDisconnected: (data) => {
      console.log("🔴 [Onboarding] Agent disconnected:", data)
      setAgentConnected(false)
    },
  })

  const steps = [
    {
      title: "Welcome to Phion!",
      description: "We'll help you use Cursor as easily as Lovable, Bolt, and other web AI IDEs",
      content: "welcome",
    },
    {
      title: "Cursor IDE",
      description: "Let's make sure you have everything you need to get started",
      content: "cursor-check",
    },
    {
      title: "Download & Setup",
      description: "Final step - download the project and open it in Cursor",
      content: "download-setup",
    },
  ]

  // Create project when moving to the last step
  useEffect(() => {
    if (currentStep === 2 && !projectId && !isCreatingProject) {
      console.log("🔧 [Onboarding] Starting project creation...")
      handleCreateProject()
    }
  }, [currentStep, projectId, isCreatingProject])

  // Auto-redirect to overview when agent connects
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (agentConnected && countdown === null && currentStep === 2) {
      // Start countdown only if agent is connected and we're on the setup step
      setCountdown(5)
    }

    if (countdown !== null && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) return null
          if (prev <= 1) {
            // Countdown finished - redirect to overview
            if (projectId) {
              onComplete()
              router.push(`/project/${projectId}/overview`)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [agentConnected, countdown, currentStep, projectId, onComplete, router])

  const handleCreateProject = async () => {
    console.log("🔧 [Onboarding] Creating project...")
    setIsCreatingProject(true)
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "My First Phion Project",
          template_type: "vite-react",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create project")
      }

      const { projectId } = await response.json()

      if (projectId) {
        console.log("✅ [Onboarding] Project created successfully:", projectId)
        setProjectId(projectId)
      } else {
        throw new Error("No project ID returned")
      }
    } catch (error) {
      console.error("❌ [Onboarding] Failed to create project:", error)
      showError(
        `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
      )
      setCurrentStep(currentStep - 1)
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleGoToProject = () => {
    if (projectId) {
      // If user clicks button before countdown, cancel countdown and go directly
      if (countdown !== null) {
        setCountdown(null)
      }
      onComplete()
      router.push(`/project/${projectId}/overview`)
    }
  }

  const renderStepContent = () => {
    switch (steps[currentStep].content) {
      case "welcome":
        return (
          <div className="flex flex-col items-center space-y-12 max-w-xl mx-auto">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
              <Logo width={40} height={40} />
            </div>

            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold text-foreground">Welcome to Phion!</h1>
              <p className="text-muted-foreground leading-relaxed">
                Create, edit, and publish projects directly from your browser, while working in your
                familiar Cursor environment.
              </p>
            </div>

            <div className="w-full space-y-3">
              <Material type="base" className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-foreground" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium">Quick Start</h3>
                  <p className="text-sm text-muted-foreground">Create projects in one click</p>
                </div>
              </Material>

              <Material type="base" className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {theme === "dark" ? (
                    <CursorDark className="w-5 h-5" />
                  ) : (
                    <CursorLight className="w-5 h-5" />
                  )}
                </div>
                <div className="text-left">
                  <h3 className="font-medium">Cursor IDE</h3>
                  <p className="text-sm text-muted-foreground">Use familiar tools</p>
                </div>
              </Material>

              <Material type="base" className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-foreground" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium">Auto-Deploy</h3>
                  <p className="text-sm text-muted-foreground">Instant publication of changes</p>
                </div>
              </Material>
            </div>

            <Button
              onClick={handleNext}
              type="primary"
              size="large"
              className="w-full max-w-xs"
              suffix={<ArrowRight className="w-4 h-4" />}
            >
              Get Started
            </Button>
          </div>
        )

      case "cursor-check":
        return (
          <div className="flex flex-col items-center space-y-8 max-w-xl mx-auto">
            <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
              {theme === "dark" ? (
                <CursorDark className="w-12 h-12" />
              ) : (
                <CursorLight className="w-12 h-12" />
              )}
            </div>

            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold">Do you have Cursor installed?</h2>
              <p className="text-muted-foreground">
                Cursor is an AI-powered code editor based on VS Code. You'll need it for local
                development.
              </p>
            </div>

            {hasCursor === null && (
              <div className="flex gap-3 w-full max-w-sm">
                <Button
                  onClick={() => {
                    setHasCursor(true)
                    // Immediately advance to next step
                    handleNext()
                  }}
                  type="secondary"
                  size="large"
                  className="flex-1"
                >
                  Yes, I have it
                </Button>
                <Button
                  onClick={() => setHasCursor(false)}
                  type="primary"
                  size="large"
                  className="flex-1"
                >
                  No, I need to download
                </Button>
              </div>
            )}

            {hasCursor === false && (
              <Material type="base" className="p-6 w-full max-w-md">
                <div className="flex items-center gap-3 mb-4">
                  <Download className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Download Cursor</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Cursor is a free editor with built-in AI assistant. Download it from the official
                  website:
                </p>
                <Button
                  onClick={() => window.open("https://cursor.com", "_blank")}
                  type="secondary"
                  size="medium"
                  className="w-full"
                >
                  Go to cursor.com
                </Button>
              </Material>
            )}

            {hasCursor === false && (
              <Button
                onClick={handleNext}
                type="primary"
                size="large"
                className="w-full max-w-xs"
                suffix={<ArrowRight className="w-4 h-4" />}
              >
                Continue
              </Button>
            )}
          </div>
        )

      case "download-setup":
        return (
          <div className="flex flex-col items-center space-y-8 max-w-xl mx-auto">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">Almost ready!</h2>
              <p className="text-muted-foreground">Set up your project in Cursor to get started</p>
            </div>

            <Material type="base" className="p-6 w-full">
              <SetupStep
                projectId={projectId || ""}
                agentConnected={agentConnected}
                onDeploy={handleGoToProject}
              />
            </Material>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
    >
      <div className="min-h-screen flex flex-col">
        <div className="p-8">
          <button
            onClick={onComplete}
            className="absolute top-6 right-10 p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
            aria-label="Skip onboarding"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="max-w-2xl mx-auto relative">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-3">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`text-xs transition-colors ${
                    index <= currentStep ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full"
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
