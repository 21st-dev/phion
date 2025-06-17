import React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const mockupVariants = cva(
  "flex relative z-10 overflow-hidden shadow-2xl border border-white/10 border-t-white/20",
  {
    variants: {
      type: {
        mobile: "rounded-[48px] max-w-[350px]",
        responsive: "rounded-md",
      },
    },
    defaultVariants: {
      type: "responsive",
    },
  },
)

export interface MockupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof mockupVariants> {}

const Mockup = React.forwardRef<HTMLDivElement, MockupProps>(
  ({ className, type, ...props }, ref) => (
    <div ref={ref} className={cn(mockupVariants({ type, className }))} {...props} />
  ),
)
Mockup.displayName = "Mockup"

const frameVariants = cva(
  "bg-gradient-to-t from-white/10 to-white/20 p-1 lg:bg-gradient-to-t lg:from-white/5 lg:to-white/15 flex relative z-10 overflow-hidden rounded-lg lg:rounded-xl w-full backdrop-blur-xl border border-white/10",
  {
    variants: {
      size: {
        small: "lg:p-2",
        large: "lg:p-4",
      },
    },
    defaultVariants: {
      size: "small",
    },
  },
)

export interface MockupFrameProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof frameVariants> {}

const MockupFrame = React.forwardRef<HTMLDivElement, MockupFrameProps>(
  ({ className, size, ...props }, ref) => (
    <div ref={ref} className={cn(frameVariants({ size, className }))} {...props} />
  ),
)
MockupFrame.displayName = "MockupFrame"

export { Mockup, MockupFrame }
