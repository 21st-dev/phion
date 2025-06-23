"use client"

import React, { createContext, useContext, useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"

interface MorphingDialogContextType {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  transition: {
    duration: number
  }
}

const MorphingDialogContext = createContext<MorphingDialogContextType | null>(null)

interface MorphingDialogProps {
  children: React.ReactNode
  transition?: {
    duration: number
    ease:
      | "linear"
      | "easeIn"
      | "easeOut"
      | "easeInOut"
      | "circIn"
      | "circOut"
      | "circInOut"
      | "backIn"
      | "backOut"
      | "backInOut"
      | "anticipate"
  }
}

export function MorphingDialog({
  children,
  transition = { duration: 0.3, ease: "easeInOut" },
}: MorphingDialogProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <MorphingDialogContext.Provider value={{ isOpen, setIsOpen, transition }}>
      {children}
    </MorphingDialogContext.Provider>
  )
}

export function MorphingDialogTrigger({ children }: { children: React.ReactNode }) {
  const context = useContext(MorphingDialogContext)
  if (!context) throw new Error("MorphingDialogTrigger must be used within MorphingDialog")

  const { setIsOpen } = context

  return (
    <div onClick={() => setIsOpen(true)} className="cursor-pointer">
      {children}
    </div>
  )
}

export function MorphingDialogContainer({ children }: { children: React.ReactNode }) {
  const context = useContext(MorphingDialogContext)
  if (!context) throw new Error("MorphingDialogContainer must be used within MorphingDialog")

  const { isOpen, setIsOpen, transition } = context

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function MorphingDialogContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const context = useContext(MorphingDialogContext)
  if (!context) throw new Error("MorphingDialogContent must be used within MorphingDialog")

  const { transition } = context

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={transition}
      className={cn("relative", className)}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  )
}

export function MorphingDialogClose({
  children,
  className,
  variants,
}: {
  children: React.ReactNode
  className?: string
  variants?: any
}) {
  const context = useContext(MorphingDialogContext)
  if (!context) throw new Error("MorphingDialogClose must be used within MorphingDialog")

  const { setIsOpen } = context

  return (
    <motion.button
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={() => setIsOpen(false)}
      className={cn("cursor-pointer", className)}
    >
      {children}
    </motion.button>
  )
}

export function MorphingDialogImage({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  return <img src={src} alt={alt} className={cn("object-cover", className)} />
}

export function MorphingDialogVideo({
  src,
  className,
  ...props
}: {
  src: string
  className?: string
} & React.VideoHTMLAttributes<HTMLVideoElement>) {
  return <video src={src} className={cn("object-cover", className)} {...props} />
}
