import React, { forwardRef } from "react"

const types = {
  base: "rounded-md shadow-border border border-border",
  small: "rounded-md shadow-border-small border border-border",
  medium: "rounded-xl shadow-border-medium border border-border",
  large: "rounded-xl shadow-border-large border border-border",
  tooltip: "rounded-md shadow-tooltip border border-border",
  menu: "rounded-xl shadow-menu border border-border",
  modal: "rounded-xl shadow-modal border border-border",
  fullscreen: "rounded-2xl shadow-fullscreen border border-border",
}

interface MaterialProps extends React.HTMLAttributes<HTMLDivElement> {
  type: keyof typeof types
  children: React.ReactNode
}

export const Material = forwardRef<HTMLDivElement, MaterialProps>(
  ({ type, children, className, ...props }, ref) => {
    return (
      <div
        className={`bg-background-100 ${types[type]}${className ? ` ${className}` : ""}`}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    )
  },
)

Material.displayName = "Material"
