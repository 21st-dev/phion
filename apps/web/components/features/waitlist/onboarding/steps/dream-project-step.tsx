"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ArrowLeftIcon, EnterIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import type { FormData } from "@/components/features/waitlist/types"

interface DreamProjectStepProps {
  formData: FormData
  onComplete: () => void
  onBack: () => void
  onFormDataUpdate: (updates: Partial<FormData>) => void
}

export function DreamProjectStep({
  formData,
  onComplete,
  onBack,
  onFormDataUpdate,
}: DreamProjectStepProps) {
  const [error, setError] = useState<string>("")

  const handleContinue = () => {
    if (!formData.dreamProject.trim()) {
      setError("Please tell us about your dream project")
      return
    }
    onComplete()
  }

  const handleChange = (value: string) => {
    onFormDataUpdate({ dreamProject: value })
    if (error) {
      setError("")
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleContinue()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onBack()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleContinue, onBack])

  return (
    <div className="flex flex-col space-y-8 px-4 max-w-[700px] mx-auto w-full z-10">
      <div className="space-y-4 max-w-2xl mx-auto text-center">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          What would you like to build?
        </h1>
        <p className="text-sm text-white/80">Just tell us what you want to create</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto w-full">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dreamProject" className="text-white">
              What do you want to build?
            </Label>
            <Textarea
              id="dreamProject"
              placeholder="e.g., A fitness app, a website for my business, a game, an automation tool..."
              value={formData.dreamProject}
              onChange={(e) => handleChange(e.target.value)}
              className={cn(
                "min-h-[100px] resize-none text-base bg-white/10 border-white/30 text-white placeholder-white/60",
                error && "border-red-400 focus-visible:ring-red-400",
              )}
              autoFocus
            />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-between items-center text-xs text-white/60">
              <span>Keep it simple</span>
              <span>{formData.dreamProject.length}/500</span>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-5 w-full pt-8 pb-4">
        <div className="flex justify-center w-full gap-2">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2 pr-1.5 bg-white/5 text-white hover:text-white hover:bg-white/15 border-none"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
            <kbd className="pointer-events-none h-5 justify-center select-none items-center gap-1 rounded border-white/40 bg-white/10 px-1.5 ml-1.5 font-sans text-[11px] text-white leading-none opacity-100 flex">
              Esc
            </kbd>
          </Button>

          <Button onClick={handleContinue} className="flex items-center gap-2 pr-1.5 bg-white/10 hover:border-white/65 text-white hover:text-white hover:bg-white/15">
            Continue
            <kbd className="pointer-events-none h-5 justify-center select-none items-center gap-1 rounded border-muted-foreground/40 bg-muted-foreground/20 px-1.5 ml-1.5 font-sans text-[11px] text-kbd leading-none opacity-100 flex">
              <span className="text-xs">⌘</span>
              <EnterIcon className="h-2.5 w-2.5" />
            </kbd>
          </Button>
        </div>
      </div>
    </div>
  )
}
