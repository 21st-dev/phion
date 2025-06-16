"use client"

import { useEffect } from "react"
import type { FormData } from "@/components/features/waitlist/types"

interface SuccessStepProps {
  formData: FormData
  onRestart: () => void
}

export function SuccessStep({ formData, onRestart }: SuccessStepProps) {
  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "r" || e.key === "R") {
        e.preventDefault()
        onRestart()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onRestart])

  return (
    <div className="flex flex-col space-y-6 px-4 max-w-[1000px] mx-auto w-full z-10">
      {/* Heading */}
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Schedule Your Onboarding Call
        </h1>
        <p className="text-base text-white/80 mt-2">
          Book a convenient time for your 15-minute conversation with our team
        </p>
      </div>

      {/* Cal.com Iframe Embedding */}
      <div className="bg-white rounded-lg overflow-hidden">
        <iframe
          src="https://cal.com/serafimcloud/phion?embed=true&theme=dark&layout=month_view&hideThemeToggle=true"
          width="100%"
          height="600"
          frameBorder="0"
          title="Schedule a call with Serafim"
          className="w-full h-[550px] md:h-[550px] sm:h-[500px]"
          style={{ minHeight: "550px", width: "100%" }}
          loading="lazy"
          allowFullScreen
        />
      </div>
    </div>
  )
}
