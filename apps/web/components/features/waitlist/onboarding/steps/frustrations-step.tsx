"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeftIcon, EnterIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import type { FormData } from "@/components/features/waitlist/types"

interface FrustrationsStepProps {
  formData: FormData
  onComplete: () => void
  onBack: () => void
  onFormDataUpdate: (updates: Partial<FormData>) => void
}

const frustrationOptions = [
  "Environment setup and configuration",
  "Dependency management and version conflicts",
  "Debugging and error messages",
  "Learning curve and complexity",
  "Context switching between tools",
]

export function FrustrationsStep({
  formData,
  onComplete,
  onBack,
  onFormDataUpdate,
}: FrustrationsStepProps) {
  const [error, setError] = useState<string>("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleContinue = () => {
    if (
      formData.frustrations.selectedOptions.length === 0 &&
      !formData.frustrations.customText.trim()
    ) {
      setError("Please select at least one frustration or describe your own")
      return
    }
    onComplete()
  }

  const handleCheckboxChange = (option: string, checked: boolean) => {
    const currentSelected = formData.frustrations.selectedOptions
    const newSelected = checked
      ? [...currentSelected, option]
      : currentSelected.filter((item) => item !== option)

    onFormDataUpdate({
      frustrations: {
        ...formData.frustrations,
        selectedOptions: newSelected,
      },
    })

    if (error) {
      setError("")
    }
  }

  const handleCustomTextChange = (value: string) => {
    onFormDataUpdate({
      frustrations: {
        ...formData.frustrations,
        customText: value,
      },
    })

    if (error) {
      setError("")
    }
  }

  // Auto-focus textarea on component mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleContinue()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onBack()
      } else if (e.key >= "1" && e.key <= "5") {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        if (frustrationOptions[index]) {
          const option = frustrationOptions[index]
          const isCurrentlySelected = formData.frustrations.selectedOptions.includes(option)
          const currentSelected = formData.frustrations.selectedOptions
          const newSelected = !isCurrentlySelected
            ? [...currentSelected, option]
            : currentSelected.filter((item) => item !== option)

          onFormDataUpdate({
            frustrations: {
              ...formData.frustrations,
              selectedOptions: newSelected,
            },
          })

          if (error) {
            setError("")
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleContinue, onBack, onFormDataUpdate, formData.frustrations, error])

  return (
    <div className="flex flex-col space-y-8 px-4 max-w-[700px] mt-10 mx-auto w-full z-10">
      <div className="space-y-4 max-w-2xl mx-auto text-center">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          What frustrates you most about coding today?
        </h1>
        <p className="text-sm text-white/80">Select all that apply and add your own if needed</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto w-full">
        <div className="space-y-4">
          <h3 className="text-base font-medium text-white">Common frustrations:</h3>
          <div className="space-y-3">
            {frustrationOptions.map((option, index) => (
              <div
                key={option}
                className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 flex items-center justify-between hover:bg-white/15 transition-colors cursor-pointer"
                onClick={() => {
                  const isCurrentlySelected = formData.frustrations.selectedOptions.includes(option)
                  handleCheckboxChange(option, !isCurrentlySelected)
                }}
              >
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id={option}
                    checked={formData.frustrations.selectedOptions.includes(option)}
                    onCheckedChange={(checked) => handleCheckboxChange(option, checked as boolean)}
                    className="border-white/30 text-white pointer-events-none"
                  />
                  <Label
                    htmlFor={option}
                    className="text-base font-normal cursor-pointer text-white pointer-events-none"
                  >
                    {option}
                  </Label>
                </div>
                <span className="text-xs text-white/60 font-mono bg-white/10 px-2 py-1 rounded pointer-events-none">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customFrustration" className="text-white">
            Or describe your own frustration
          </Label>
          <Textarea
            ref={textareaRef}
            id="customFrustration"
            placeholder="e.g., I struggle with choosing the right framework for my projects, or my code works locally but breaks in production..."
            value={formData.frustrations.customText}
            onChange={(e) => handleCustomTextChange(e.target.value)}
            className="min-h-[100px] resize-none text-base bg-white/10 border-white/30 text-white placeholder-white/60"
          />
          <div className="flex justify-between items-center text-xs text-white/60">
            <span>Be as detailed as you'd like</span>
            <span>{formData.frustrations.customText.length}/500</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-300 text-center">{error}</p>}
      </div>

      <div className="sticky bottom-5 w-full pt-8 pb-4">
        <div className="flex justify-center w-full gap-2">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2 pr-1.5 bg-white/5 text-white hover:bg-white/15 hover:border-white/30 hover:text-white border-none"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
            <kbd className="pointer-events-none h-5 justify-center select-none items-center gap-1 rounded border-white/60 bg-black/50 px-1.5 ml-1.5 font-sans text-[11px] text-white leading-none opacity-100 flex">
              Esc
            </kbd>
          </Button>

          <Button
            onClick={handleContinue}
            className="flex items-center gap-2 pr-1.5 bg-white/10 hover:border-white/65 text-white hover:text-white hover:bg-white/15"
          >
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
