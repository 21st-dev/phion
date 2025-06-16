"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/geist/button"
import { PricingModal } from "@/components/pricing-dialog"
import { useProjectLimits } from "@/hooks/use-project-limits"
import { useToast } from "@/hooks/use-toast"

interface CreateProjectButtonProps {
  trigger?: React.ReactNode
}

// Интересные пары слов для названий проектов
const adjectives = [
  "Cosmic",
  "Lunar",
  "Solar",
  "Stellar",
  "Quantum",
  "Digital",
  "Cyber",
  "Neural",
  "Electric",
  "Magnetic",
  "Atomic",
  "Photonic",
  "Sonic",
  "Hyper",
  "Ultra",
  "Meta",
  "Zen",
  "Nova",
  "Pixel",
  "Vector",
  "Matrix",
  "Fusion",
  "Prism",
  "Vortex",
  "Echo",
  "Swift",
  "Blaze",
  "Storm",
  "Wave",
  "Flow",
  "Spark",
  "Glow",
]

const nouns = [
  "Phoenix",
  "Comet",
  "Galaxy",
  "Nebula",
  "Orbit",
  "Beacon",
  "Portal",
  "Engine",
  "Factory",
  "Lab",
  "Studio",
  "Forge",
  "Workshop",
  "Haven",
  "Hub",
  "Core",
  "Nexus",
  "Grid",
  "Network",
  "System",
  "Platform",
  "Interface",
  "Terminal",
  "Console",
  "Canvas",
  "Palette",
  "Brush",
  "Frame",
  "Stage",
  "Arena",
  "Zone",
  "Realm",
]

function generateProjectName(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adjective} ${noun}`
}

export function CreateProjectButton({ trigger }: CreateProjectButtonProps) {
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()
  const { error: showError, success: showSuccess } = useToast()
  const {
    canCreateProject,
    projectCount,
    maxProjects,
    isLoading: limitsLoading,
    refetch,
  } = useProjectLimits()

  const handleCreateProject = async () => {
    if (!canCreateProject) {
      setShowPricingModal(true)
      return
    }

    setIsCreating(true)
    const projectName = generateProjectName()

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName,
          template_type: "vite-react",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create project")
      }

      const data = await response.json()

      showSuccess("Project created successfully", `"${projectName}" is ready for setup`)

      // Быстрый redirect - пользователь увидит страницу с прогрессом
      router.push(`/project/${data.project.id}/onboarding`)
    } catch (error) {
      console.error("Error creating project:", error)
      showError("Failed to create project", "Please try again")
    } finally {
      setIsCreating(false)
    }
  }

  const createButton = trigger || (
    <Button
      size="medium"
      type="primary"
      onClick={handleCreateProject}
      disabled={limitsLoading || isCreating}
      loading={isCreating}
      prefix={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      }
    >
      {isCreating ? "Creating..." : limitsLoading ? "Loading..." : "New Project"}
    </Button>
  )

  return (
    <>
      {canCreateProject ? (
        createButton
      ) : (
        <>
          {trigger ? (
            <div onClick={() => setShowPricingModal(true)} style={{ display: "inline-block" }}>
              {trigger}
            </div>
          ) : (
            <Button
              size="medium"
              type="secondary"
              onClick={() => setShowPricingModal(true)}
              disabled={limitsLoading}
              prefix={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 5v14m-7-7h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              }
            >
              {limitsLoading ? "Loading..." : "Create New"}
            </Button>
          )}

          <PricingModal
            open={showPricingModal}
            onOpenChange={(open) => {
              setShowPricingModal(open)
              if (!open) {
                refetch()
              }
            }}
          />
        </>
      )}
    </>
  )
}
