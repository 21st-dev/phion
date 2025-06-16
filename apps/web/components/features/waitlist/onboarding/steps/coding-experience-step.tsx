"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeftIcon, EnterIcon } from "@/components/icons"
import type { FormData } from "@/components/features/waitlist/types"

interface CodingExperienceStepProps {
  formData: FormData
  onComplete: () => void
  onBack?: () => void
  onFormDataUpdate: (updates: Partial<FormData>) => void
}

const experienceOptions = [
  {
    value: "complete-beginner",
    label: "Complete beginner",
    description: "I've never coded before",
  },
  {
    value: "some-experience",
    label: "Some experience",
    description: "I've tried tutorials or simple projects",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    description: "I can build basic applications",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "I'm comfortable with most programming concepts",
  },
  {
    value: "expert",
    label: "Expert",
    description: "I'm a professional developer",
  },
]

export function CodingExperienceStep({
  formData,
  onComplete,
  onBack,
  onFormDataUpdate,
}: CodingExperienceStepProps) {
  const [error, setError] = useState<string>("")

  const handleContinue = () => {
    if (!formData.codingExperience) {
      setError("Please select your coding experience level")
      return
    }
    onComplete()
  }

  const handleValueChange = (value: string) => {
    onFormDataUpdate({ codingExperience: value })
    if (error) {
      setError("")
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleContinue()
      } else if (e.key === "Escape" && onBack) {
        e.preventDefault()
        onBack()
      } else if (e.key >= "1" && e.key <= "5") {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        if (experienceOptions[index]) {
          onFormDataUpdate({ codingExperience: experienceOptions[index].value })
          if (error) {
            setError("")
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onComplete, onBack, onFormDataUpdate, error])

  return (
    <div className="flex flex-col space-y-8 px-4 max-w-[700px] mx-auto w-full z-10">
      <div className="space-y-4 max-w-2xl mx-auto text-center">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          What's your coding experience?
        </h1>
        <p className="text-sm text-white/80">This helps us tailor the experience for you</p>
      </div>

      <div className="space-y-4 max-w-2xl mx-auto w-full">
        <RadioGroup
          value={formData.codingExperience}
          onValueChange={handleValueChange}
          className="space-y-3"
        >
          {experienceOptions.map((option, index) => (
            <div
              key={option.value}
              className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 flex items-center justify-between hover:bg-white/15 transition-colors cursor-pointer"
              onClick={() => handleValueChange(option.value)}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="border-white/30 text-white data-[state=checked]:border-blue-500 data-[state=checked]:text-blue-500 pointer-events-none"
                  />
                  <div className="flex items-center space-x-2">
                    <Label
                      htmlFor={option.value}
                      className="text-base font-normal cursor-pointer pointer-events-none text-white"
                    >
                      {option.label}
                    </Label>
                    <span className="text-sm text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">{option.description}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono bg-white/10 px-2 py-1 rounded pointer-events-none">
                  {index + 1}
                </span>
              </div>
            </div>
          ))}
        </RadioGroup>

        {error && <p className="text-sm text-red-300 text-center mt-4">{error}</p>}
      </div>

      <div className="sticky bottom-5 w-full pt-8 pb-4">
        <div className="flex justify-center w-full gap-2">
          {onBack && (
            <Button
              variant="outline"
              onClick={onBack}
              className="flex items-center gap-2 pr-1.5 bg-white/5 border-white/20 text-white hover:bg-white/20"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
              <kbd className="pointer-events-none h-5 justify-center select-none items-center gap-1 rounded border-white/40 bg-white/10 px-1.5 ml-1.5 font-sans text-[11px] text-white leading-none opacity-100 flex">
                Esc
              </kbd>
            </Button>
          )}

          <Button
            onClick={handleContinue}
            className="flex items-center gap-2 pr-1.5 bg-white/10 hover:border-white/65 text-white hover:text-white hover:bg-white/15"
          >
            Continue
            <kbd className="pointer-events-none h-5 justify-center select-none items-center gap-1 rounded border-muted-foreground/40 bg-muted-foreground/20 px-1.5 ml-1.5 font-sans text-[11px] text-kbd leading-none opacity-100 flex">
              <EnterIcon className="h-2.5 w-2.5" />
            </kbd>
          </Button>
        </div>

        <div className="flex items-center justify-center gap-6 text-xs text-white/60 mt-4">
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono bg-white/10 px-1.5 py-0.5 rounded">1-5</span>
            <span>Quick select</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono bg-white/10 px-1.5 py-0.5 rounded">Click</span>
            <span>Select option</span>
          </div>
        </div>
      </div>
    </div>
  )
}
