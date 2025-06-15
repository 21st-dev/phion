"use client"

import { CreateProjectDialog } from "@/components/create-project-dialog"
import { Button } from "@/components/geist/button"
import { PricingModal } from "@/components/pricing-dialog"
import { useProjectLimits } from "@/hooks/use-project-limits"
import { useState } from "react"

interface CreateProjectButtonProps {
  trigger?: React.ReactNode
}

export function CreateProjectButton({ trigger }: CreateProjectButtonProps) {
  const [showPricingModal, setShowPricingModal] = useState(false)
  const {
    canCreateProject,
    projectCount,
    maxProjects,
    isLoading: limitsLoading,
    refetch,
  } = useProjectLimits()

  const createButton = trigger || (
    <Button
      size="medium"
      type="secondary"
      onClick={() => (canCreateProject ? null : setShowPricingModal(true))}
      disabled={limitsLoading}
      prefix={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      }
    >
      {limitsLoading ? "Loading..." : "Create New"}
    </Button>
  )

  return (
    <>
      {canCreateProject ? (
        <CreateProjectDialog trigger={createButton} />
      ) : (
        <>
          {trigger ? (
            <div onClick={() => setShowPricingModal(true)} style={{ display: "inline-block" }}>
              {trigger}
            </div>
          ) : (
            createButton
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
