"use client"

import { ReactNode } from "react"

interface ProjectSetupLayoutProps {
  children: ReactNode
  className?: string
}

export function ProjectSetupLayout({ children, className = "" }: ProjectSetupLayoutProps) {
  return <div className={`${className}`}>{children}</div>
}
