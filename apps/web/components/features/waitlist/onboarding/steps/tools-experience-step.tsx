"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeftIcon, EnterIcon } from "@/components/icons"
import { cn } from "@/lib/utils"
import type { FormData } from "@/components/features/waitlist/types"

interface ToolsExperienceStepProps {
  formData: FormData
  onComplete: () => void
  onBack: () => void
  onFormDataUpdate: (updates: Partial<FormData>) => void
}

const toolsOptions = [
  { value: "lovable", label: "Lovable" },
  { value: "cursor", label: "Cursor" },
  { value: "windsurf", label: "Windsurf" },
  { value: "bolt", label: "Bolt" },
  { value: "v0", label: "v0" },
  { value: "claude-code", label: "Claude Code" },
  { value: "jetbrains-ai", label: "JetBrains AI" },
  { value: "replit", label: "Replit" },
  { value: "none", label: "None of the above" },
]

export function ToolsExperienceStep({
  formData,
  onComplete,
  onBack,
  onFormDataUpdate,
}: ToolsExperienceStepProps) {
  const [error, setError] = useState<string>("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleContinue = () => {
    if (!formData.toolsUsed) {
      setError("Please select which tool you've used the most")
      return
    }
    if (formData.toolsUsed !== "none" && !formData.toolDislike.trim()) {
      setError(`Please tell us what you didn't like about ${toolsOptions.find((t) => t.value === formData.toolsUsed)?.label}`)
      return
    }
    onComplete()
  }

  const handleToolChange = (value: string) => {
    onFormDataUpdate({ toolsUsed: value })
    if (error) {
      setError("")
    }

    // Focus the textarea if a tool other than "none" is selected
    if (value !== "none") {
      // Use requestAnimationFrame to ensure the DOM has updated
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
      })
    }
  }

  const handleDislikeChange = (value: string) => {
    onFormDataUpdate({ toolDislike: value })
    if (error) {
      setError("")
    }
  }

  // Effect to focus textarea when a tool is selected
  useEffect(() => {
    if (formData.toolsUsed && formData.toolsUsed !== "none" && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [formData.toolsUsed])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleContinue()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onBack()
      } else if (e.key >= "1" && e.key <= "9") {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        if (toolsOptions[index]) {
          handleToolChange(toolsOptions[index].value)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [formData])

  const showDislikeQuestion = formData.toolsUsed && formData.toolsUsed !== "none"

  return (
    <div className="flex flex-col space-y-8 px-4 max-w-[700px] mx-auto w-full z-10">
      <div className="space-y-4 max-w-2xl mx-auto text-center">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Which vibe-coding tool have you used the most?
        </h1>
        <p className="text-sm text-white/80">
          We're talking about tools where you <span className="font-bold text-white italic">actually built something</span>, not just tested
        </p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto w-full">
        <div className="space-y-4">
          <RadioGroup
            value={formData.toolsUsed}
            onValueChange={handleToolChange}
            className="grid grid-cols-3 gap-3"
          >
            {toolsOptions.map((option, index) => {
              const isSelected = formData.toolsUsed === option.value

              return (
                <div
                  key={option.value}
                  className={cn(
                    "relative bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-3 hover:bg-white/15 transition-all cursor-pointer flex items-center",
                    isSelected && "bg-white/20 border-white/40 ring-2 ring-white/30",
                  )}
                  onClick={() => handleToolChange(option.value)}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="border-white/30 text-white pointer-events-none w-4 h-4"
                  />
                  <span className="absolute right-2 text-xs text-white/60 font-mono bg-white/10 px-1.5 py-0.5 rounded pointer-events-none">
                    {index + 1}
                  </span>
                  <Label
                    htmlFor={option.value}
                    className="text-sm font-medium cursor-pointer text-white pointer-events-none ml-2"
                  >
                    {option.label}
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        </div>

        {showDislikeQuestion && (
          <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <Label htmlFor="toolDislike" className="text-white">
              What didn't you like about{" "}
              {toolsOptions.find((t) => t.value === formData.toolsUsed)?.label}?
            </Label>
            <Textarea
              ref={textareaRef}
              id="toolDislike"
              placeholder="e.g., It was too slow, hard to debug, limited customization, poor error messages..."
              value={formData.toolDislike}
              onChange={(e) => handleDislikeChange(e.target.value)}
              className={cn(
                "min-h-[100px] resize-none text-base bg-white/10 border-white/30 text-white placeholder-white/60",
                error && "border-red-400 focus-visible:ring-red-400",
              )}
            />
            <div className="flex justify-between items-center text-xs text-white/60">
              <span>Be honest - this helps us build better</span>
              <span>{formData.toolDislike.length}/500</span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-300 text-center">{error}</p>}
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
            <kbd className="pointer-events-none h-5 justify-center select-none items-center gap-1 rounded border-white/60 bg-black/50 px-1.5 ml-1.5 font-sans text-[11px] text-white leading-none opacity-100 flex">
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

        <div className="flex items-center justify-center gap-6 text-xs text-white/60 mt-4">
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono bg-white/10 px-1.5 py-0.5 rounded">1-9</span>
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
