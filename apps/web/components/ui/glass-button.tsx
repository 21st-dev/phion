import React from "react"
import { cn } from "@/lib/utils"

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  children: React.ReactNode
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  loading,
  children,
  className,
  ...props
}) => {
  return (
    <button
      disabled={props.disabled || loading}
      {...props}
      className={cn(
        "group relative flex items-center backdrop-blur-2xl justify-center gap-2 w-full h-12 rounded-[28px] px-4 py-2 text-sm font-semibold leading-tight",
        "whitespace-nowrap",
        "text-foreground",
        "bg-[radial-gradient(61.35%_50.07%_at_48.58%_50%,rgba(255,255,255,0.8)_0%,rgba(255,255,255,0.4)_100%)] [box-shadow:inset_0_0_0_0.5px_rgba(134,143,151,0.3),inset_1px_1px_0_-0.5px_rgba(134,143,151,0.5),inset_-1px_-1px_0_-0.5px_rgba(134,143,151,0.5)]",
        "after:absolute after:inset-0 after:rounded-[28px] after:opacity-0 after:transition-opacity after:duration-200",
        "after:bg-[radial-gradient(61.35%_50.07%_at_48.58%_50%,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.6)_100%)] after:[box-shadow:inset_0_0_0_0.5px_hsl(var(--border)),inset_1px_1px_0_-0.5px_hsl(var(--border)),inset_-1px_-1px_0_-0.5px_hsl(var(--border)),0_0_3px_rgba(0,0,0,0.1)]",
        "hover:after:opacity-50 disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      <span className="relative z-10 flex items-center gap-2">
        {loading && (
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
        )}
        {children}
      </span>
    </button>
  )
}

GlassButton.displayName = "GlassButton"
export default GlassButton
