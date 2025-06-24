"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface LogoProps {
  width?: number
  height?: number
  className?: string
  forceDark?: boolean
}

export function Logo({ width = 32, height = 32, className = "", forceDark = false }: LogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRotate, setShouldRotate] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (!isAnimating && !shouldRotate) {
      setIsAnimating(true)
      setShouldRotate(true)
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    // If not animating, we can immediately return to normal state
    if (!isAnimating) {
      setShouldRotate(false)
    }
  }

  const handleTransitionEnd = () => {
    setIsAnimating(false)
    // If mouse left during animation, return to normal state
    if (!isHovered) {
      setShouldRotate(false)
    }
  }

  if (!mounted) {
    // Return a proper logo during SSR to avoid hydration mismatch
    const logoSrc = forceDark ? "/brand/white-icon.svg" : "/brand/black-icon.svg"
    return (
      <img
        src={logoSrc}
        alt="Phion Logo"
        width={width}
        height={height}
        className={`object-contain ${className}`}
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    )
  }

  const isDark = forceDark || resolvedTheme === "dark"
  const logoSrc = isDark ? "/brand/white-icon.svg" : "/brand/black-icon.svg"

  return (
    <img
      src={logoSrc}
      alt="Phion Logo"
      width={width}
      height={height}
      className={`object-contain transition-transform duration-500 ease-in-out ${
        shouldRotate ? "rotate-[360deg]" : "rotate-0"
      } ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTransitionEnd={handleTransitionEnd}
    />
  )
}
