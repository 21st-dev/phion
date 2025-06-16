"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeftIcon, EnterIcon } from "@/components/icons"
import type { FormData } from "@/components/features/waitlist/types"

interface CallPreferenceStepProps {
  formData: FormData
  onComplete: () => void
  onBack: () => void
  onFormDataUpdate: (updates: Partial<FormData>) => void
}

const callOptions = [
  {
    value: "yes",
    label: "Yes, I'd love to chat!",
    description: "We'll reach out to schedule a brief conversation about your goals",
  },
  {
    value: "no",
    label: "No thanks, just keep me updated",
    description: "We'll notify you via email when we're ready to launch",
  },
]

export function CallPreferenceStep({
  formData,
  onComplete,
  onBack,
  onFormDataUpdate,
}: CallPreferenceStepProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>("")

  const handleContinue = useCallback(async () => {
    setSubmitting(true)
    setError("")

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to submit application")
      }

      // If user doesn't want a call, redirect to home page
      if (!formData.acceptsCall) {
        window.location.href = "/"
        return
      }

      // If user wants a call, proceed to success step (calendar)
      onComplete()
    } catch (error) {
      console.error("Submission error:", error)
      setError(error instanceof Error ? error.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }, [formData, onComplete])

  const handleValueChange = (value: string) => {
    onFormDataUpdate({ acceptsCall: value === "yes" })
    if (error) {
      setError("")
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleContinue()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onBack()
      } else if (e.key === "1" || e.key === "2") {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        if (callOptions[index]) {
          onFormDataUpdate({ acceptsCall: callOptions[index].value === "yes" })
          if (error) {
            setError("")
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleContinue, onFormDataUpdate, onBack, error])

  const selectedValue = formData.acceptsCall ? "yes" : "no"

  return (
    <div className="flex flex-col space-y-8 px-4 max-w-[700px] mx-auto w-full z-10">
      <div className="space-y-4 max-w-2xl mx-auto text-center">
        <h1 className="text-xl font-semibold tracking-tight text-white">One last thing...</h1>
        <p className="text-sm text-white/80">
          Would you be interested in a brief call with our team?
        </p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto w-full">
        <div className="space-y-3">
          <RadioGroup value={selectedValue} onValueChange={handleValueChange} className="space-y-3">
            {callOptions.map((option, index) => (
              <div
                key={option.value}
                className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 hover:bg-white/15 transition-colors cursor-pointer"
                onClick={() => handleValueChange(option.value)}
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="mt-1 border-white/30 text-white pointer-events-none"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={option.value}
                      className="text-base font-normal cursor-pointer flex items-center gap-2 text-white pointer-events-none"
                    >
                      <span className="text-xs text-white/60 font-mono bg-white/10 px-1.5 py-0.5 rounded">
                        {index + 1}
                      </span>
                      {option.label}
                    </Label>
                    <p className="text-sm text-white/70 ml-7 pointer-events-none">
                      {option.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </RadioGroup>

          {error && <p className="text-sm text-red-300 text-center">{error}</p>}

          <div className="p-4 space-y-2">
            <h3 className="text-sm font-medium text-white">What to expect:</h3>
            <ul className="text-sm text-white/70 space-y-1">
              <li>• 15-minute casual conversation</li>
              <li>• Learn more about your specific needs</li>
              <li>• Get early access to beta features</li>
              <li>• Shape the future of the platform</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="sticky bottom-5 w-full pt-8 pb-4">
        <div className="flex justify-center w-full gap-2">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2 pr-1.5 bg-white/5 text-white hover:text-white hover:bg-white/15 border-none"
            disabled={submitting}
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
            disabled={submitting}
          >
            {submitting
              ? "Submitting..."
              : formData.acceptsCall
              ? "Book Call"
              : "Submit Application"}
            {!submitting && (
              <kbd className="pointer-events-none h-5 justify-center select-none items-center gap-1 rounded border-muted-foreground/40 bg-muted-foreground/20 px-1.5 ml-1.5 font-sans text-[11px] text-kbd leading-none opacity-100 flex">
                <EnterIcon className="h-2.5 w-2.5" />
              </kbd>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-6 text-xs text-white/60 mt-4">
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono bg-white/10 px-1.5 py-0.5 rounded">1-2</span>
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
