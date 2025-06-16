"use client"

import { useTheme } from "next-themes"
import Image from "next/image"
import { useEffect, useState } from "react"

interface LogoProps {
  width?: number
  height?: number
  className?: string
}

export function Logo({ width = 32, height = 32, className = "" }: LogoProps) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return a placeholder during SSR to avoid hydration mismatch
    return <div className={`bg-gray-200 rounded ${className}`} style={{ width, height }} />
  }

  const isDark = resolvedTheme === "dark"
  const logoSrc = isDark ? "/brand/dark.png" : "/brand/light.png"

  return (
    <Image
      src={logoSrc}
      alt="Phion Logo"
      width={width}
      height={height}
      className={`object-contain ${className}`}
      priority
    />
  )
}
