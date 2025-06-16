"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { CodingExperienceStep } from "@/components/features/waitlist/onboarding/steps/coding-experience-step"
import { FrustrationsStep } from "@/components/features/waitlist/onboarding/steps/frustrations-step"
import { ToolsExperienceStep } from "@/components/features/waitlist/onboarding/steps/tools-experience-step"
import { DreamProjectStep } from "@/components/features/waitlist/onboarding/steps/dream-project-step"
import { CallPreferenceStep } from "@/components/features/waitlist/onboarding/steps/call-preference-step"
import { SuccessStep } from "@/components/features/waitlist/onboarding/steps/success-step"
import { cn } from "@/lib/utils"
import type { WaitlistStep, FormData } from "@/components/features/waitlist/types"

interface WaitlistPageClientProps {
  userEmail: string
  userName: string
}

export default function WaitlistPageClient({ userEmail, userName }: WaitlistPageClientProps) {
  const [currentStep, setCurrentStep] = useState<WaitlistStep>("coding-experience")
  const [formData, setFormData] = useState<FormData>({
    email: userEmail,
    name: userName,
    codingExperience: "",
    frustrations: {
      selectedOptions: [],
      customText: "",
    },
    toolsUsed: "",
    toolDislike: "",
    dreamProject: "",
    acceptsCall: false,
  })

  const handleStepComplete = (nextStep: WaitlistStep) => {
    setCurrentStep(nextStep)
  }

  const handleFormDataUpdate = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }

  const getCurrentStepIndex = (): number => {
    const steps: WaitlistStep[] = [
      "coding-experience",
      "frustrations",
      "tools-experience",
      "dream-project",
      "call-preference",
      "success",
    ]
    return steps.indexOf(currentStep)
  }

  const getTotalSteps = (): number => {
    return 6 // coding-experience, frustrations, tools-experience, dream-project, call-preference, success
  }

  return (
    <div
      className="min-h-screen w-full bg-background antialiased relative flex items-center bg-black"
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60 pointer-events-none" />

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-white/80">
              Step {getCurrentStepIndex() + 1} of {getTotalSteps()}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-48 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-500 ease-out"
                style={{
                  width: `${((getCurrentStepIndex() + 1) / getTotalSteps()) * 100}%`,
                }}
              />
            </div>
            <span className="text-sm text-white/80">
              {Math.round(((getCurrentStepIndex() + 1) / getTotalSteps()) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-3 sm:p-6 w-full z-10 pt-20">
        <div className="w-full max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
              transition={{
                duration: 0.5,
                ease: [0.23, 1, 0.32, 1],
              }}
            >
              {currentStep === "coding-experience" && (
                <CodingExperienceStep
                  formData={formData}
                  onComplete={() => handleStepComplete("frustrations")}
                  onBack={undefined}
                  onFormDataUpdate={handleFormDataUpdate}
                />
              )}

              {currentStep === "frustrations" && (
                <FrustrationsStep
                  formData={formData}
                  onComplete={() => handleStepComplete("tools-experience")}
                  onBack={() => handleStepComplete("coding-experience")}
                  onFormDataUpdate={handleFormDataUpdate}
                />
              )}

              {currentStep === "tools-experience" && (
                <ToolsExperienceStep
                  formData={formData}
                  onComplete={() => handleStepComplete("dream-project")}
                  onBack={() => handleStepComplete("frustrations")}
                  onFormDataUpdate={handleFormDataUpdate}
                />
              )}

              {currentStep === "dream-project" && (
                <DreamProjectStep
                  formData={formData}
                  onComplete={() => handleStepComplete("call-preference")}
                  onBack={() => handleStepComplete("tools-experience")}
                  onFormDataUpdate={handleFormDataUpdate}
                />
              )}

              {currentStep === "call-preference" && (
                <CallPreferenceStep
                  formData={formData}
                  onComplete={() => handleStepComplete("success")}
                  onBack={() => handleStepComplete("dream-project")}
                  onFormDataUpdate={handleFormDataUpdate}
                />
              )}

              {currentStep === "success" && (
                <SuccessStep
                  formData={formData}
                  onRestart={() => {
                    setCurrentStep("coding-experience")
                    setFormData({
                      email: userEmail,
                      name: userName,
                      codingExperience: "",
                      frustrations: {
                        selectedOptions: [],
                        customText: "",
                      },
                      toolsUsed: "",
                      toolDislike: "",
                      dreamProject: "",
                      acceptsCall: false,
                    })
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
