"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ArrowRight, Download, CheckCircle2, Zap, Copy, X } from "lucide-react"
import { Button } from "@/components/geist/button"
import { Material } from "@/components/geist/material"
import { useRouter } from "next/navigation"
import { useWebSocket } from "@/hooks/use-websocket"
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/geist/spinner"
import { CursorLight } from "@/components/icons/cursor-light"
import { CursorDark } from "@/components/icons/cursor-dark"
import { Logo } from "@/components/brand"
import { useTheme } from "next-themes"

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
  const [downloadStarted, setDownloadStarted] = useState(false)
  const [projectProgress, setProjectProgress] = useState(0)
  const [projectReady, setProjectReady] = useState(false)
  const [initializationStage, setInitializationStage] = useState("")
  const [agentConnected, setAgentConnected] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const { error: showError, success: showSuccess } = useToast()

  useWebSocket({
    projectId: projectId || undefined,
    onInitializationProgress: (data) => {
      console.log("📊 [Onboarding] Initialization progress received:", data)
      setProjectProgress(data.progress)
      setInitializationStage(data.stage)
      if (data.progress >= 100) {
        // Immediately advance to download step when initialization completes
        handleNext()
      }
    },
    onDeployStatusUpdate: (data) => {
      console.log("🚀 [Onboarding] Deploy status update received:", data)
      if (data.status && data.status !== "pending") {
        setProjectReady(true)
        // Immediately advance to download step if we're on the project creation step
        if (currentStep === 2) {
          handleNext()
        }
      }
    },
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
      title: "Your First Project",
      description: "We're creating a starter project for you",
      content: "project-creation",
    },
    {
      title: "Download & Setup",
      description: "Final step - download the project and open it in Cursor",
      content: "download-setup",
    },
  ]

  useEffect(() => {
    if (currentStep === 2 && !projectId && !isCreatingProject) {
      console.log("🔧 [Onboarding] Starting project creation...")
      handleCreateProject()
    }
  }, [currentStep, projectId, isCreatingProject])

  // Auto-redirect to overview when agent connects (like in setup-step.tsx)
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (agentConnected && countdown === null && currentStep === 3) {
      // Start countdown only if agent is connected and we're on the download step
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
        // Don't immediately set projectReady - wait for WebSocket updates
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

  const handleDownload = () => {
    if (projectId) {
      setDownloadStarted(true)
      window.open(`/api/projects/${projectId}/download`, "_blank")
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

  const getButtonText = () => {
    if (!agentConnected) {
      return "Waiting for Agent Connection..."
    }
    if (countdown !== null && countdown > 0) {
      return `Auto-redirect in ${countdown}s`
    }
    return "Continue to Project"
  }

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText("chmod +x setup.sh && ./setup.sh")
      showSuccess("Copied to clipboard")
    } catch (err) {
      showError("Failed to copy command")
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

      case "project-creation":
        return (
          <div className="flex flex-col items-center space-y-8 max-w-xl mx-auto">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold">Creating your first project</h2>
              <p className="text-muted-foreground">
                We&apos;ll automatically set up &quot;My First Phion Project&quot;.
              </p>
            </div>

            {(isCreatingProject || !projectReady) && (
              <div className="flex flex-col items-center space-y-4">
                <Spinner size={32} />
                <p className="text-sm text-muted-foreground">
                  {isCreatingProject ? "Creating project..." : "Initializing project..."}
                </p>
                {projectId && (
                  <div className="w-full max-w-xs space-y-2">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${projectProgress}%` }}
                      />
                    </div>
                    {initializationStage && (
                      <p className="text-xs text-muted-foreground text-center">
                        {initializationStage === "generating_files" && "Preparing files..."}
                        {initializationStage === "uploading_files" && "Uploading files..."}
                        {initializationStage === "creating_blobs" && "Processing files..."}
                        {initializationStage === "creating_commit" && "Saving project..."}
                        {initializationStage === "finalizing" && "Finalizing..."}
                        {initializationStage === "completed" && "Ready!"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )

      case "download-setup":
        return (
          <div className="flex flex-col items-center space-y-8 max-w-xl mx-auto">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold">Almost ready!</h2>
              <p className="text-muted-foreground">
                Download the project and open it in Cursor to get started
              </p>
            </div>

            <Material type="base" className="p-6 space-y-6 w-full">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-primary">
                  1
                </div>
                <div className="flex-1 space-y-3">
                  <h3 className="font-medium">Download project</h3>
                  <Button
                    onClick={handleDownload}
                    disabled={!projectReady}
                    type="primary"
                    size="medium"
                    prefix={<Download className="w-4 h-4" />}
                  >
                    Download ZIP
                  </Button>
                  {downloadStarted && (
                    <p className="text-sm text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Download started
                    </p>
                  )}
                </div>
              </div>

              <div className={`flex items-start gap-4 ${!downloadStarted ? "opacity-60" : ""}`}>
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${downloadStarted ? "bg-muted text-primary" : "bg-muted text-muted-foreground"}`}
                >
                  2
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-medium mb-1">Extract and open in Cursor</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>• Double-click the ZIP file to extract it</p>
                    <p>• Open Cursor app</p>
                    <p>
                      • Press{" "}
                      <kbd className="px-1.5 py-0.5 bg-background text-foreground rounded text-xs font-mono border">
                        Cmd + O
                      </kbd>{" "}
                      or File → Open Folder
                    </p>
                    <p>• Select your extracted project folder</p>
                  </div>
                </div>
              </div>

              <div className={`flex items-start gap-4 ${!downloadStarted ? "opacity-60" : ""}`}>
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${downloadStarted ? "bg-muted text-primary" : "bg-muted text-muted-foreground"}`}
                >
                  3
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-medium mb-1">Run setup</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      • Press{" "}
                      <kbd className="px-1.5 py-0.5 bg-background text-foreground rounded text-xs font-mono border">
                        Cmd + J
                      </kbd>{" "}
                      or Terminal → New Terminal
                    </p>
                    <div className="flex items-center gap-2">
                      <span>• Run:</span>
                      <div className="flex items-center bg-background border rounded px-2 py-1 flex-1">
                        <code className="text-xs font-mono text-foreground flex-1">
                          chmod +x setup.sh && ./setup.sh
                        </code>
                        <Button
                          onClick={handleCopyCommand}
                          type="tertiary"
                          size="small"
                          className="ml-2 h-6 w-6 p-0"
                          prefix={<Copy className="w-3 h-3" />}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Material>

            {downloadStarted && (
              <div className="text-center space-y-3">
                <Button
                  onClick={handleGoToProject}
                  type="secondary"
                  size="large"
                  className="w-full max-w-xs"
                  disabled={!agentConnected && countdown === null}
                >
                  {getButtonText()}
                </Button>
                {agentConnected && countdown !== null && countdown > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Agent connected! Redirecting automatically...
                  </p>
                )}
              </div>
            )}
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
        <div className="px-8 pt-8 pb-4">
          <button
            onClick={onComplete}
            className="absolute top-10 right-10 p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
            aria-label="Skip onboarding"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="max-w-3xl mx-auto relative">
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
