"use client"

import { Logo } from "@/components/brand"
import { Button } from "@/components/geist/button"
import { useToast } from "@/hooks/use-toast"
import { createAuthBrowserClient } from "@shipvibes/database"
import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/geist/spinner"
import { Play, ArrowRight, X } from "lucide-react"
import { Mockup, MockupFrame } from "@/components/ui/mockup"
import { motion, AnimatePresence } from "motion/react"
import { HeroHeader } from "@/components/layout/hero-header"
import { TextEffect } from "@/components/motion/text-effect"
import { AnimatedGroup } from "@/components/motion/animated-group"
import FeaturesSection from "@/components/features-section"
import FAQSection from "@/components/faq-section"
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogVideo,
} from "@/components/core/morphing-dialog"

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
      filter: "blur(12px)",
      y: 12,
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        type: "spring",
        bounce: 0.3,
        duration: 1.5,
      },
    },
  },
}

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isVideoReadyToPlay, setIsVideoReadyToPlay] = useState(false)
  const supabase = createAuthBrowserClient()
  const { error: showError } = useToast()
  const router = useRouter()

  useEffect(() => {
    // Check user status in background without blocking UI
    checkUserStatus()
  }, [])

  const checkUserStatus = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    } catch (error) {
      console.error("Error checking user status:", error)
    }
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error("Error during Google login:", error.message)
        showError("Login failed", error.message)
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      showError("Login failed", "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGitHubLogin = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error("Error during GitHub login:", error.message)
        showError("Login failed", error.message)
      }
    } catch (error) {
      console.error("Unexpected error:", error)
      showError("Login failed", "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <HeroHeader
        user={user}
        onSignOut={async () => {
          await supabase.auth.signOut()
          setUser(null)
        }}
        onGoogleLogin={handleGoogleLogin}
        onGitHubLogin={handleGitHubLogin}
        isLoading={isLoading}
      />
      <main className="overflow-hidden bg-[#08090A] font-inter">
        {/* Background Effects */}
        <div aria-hidden className="absolute inset-0 isolate contain-strict">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-white/5 rounded-full blur-2xl"></div>
          <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-white/8 rounded-full blur-3xl"></div>
        </div>

        {/* Hero Section */}
        <section className="relative">
          <div className="relative pt-24 md:pt-36">
            <div className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,rgb(0,0,0)_75%)]"></div>
            {/* Additional hero glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-96 bg-white/5 rounded-full blur-3xl -z-10"></div>
            <div className="mx-auto max-w-7xl px-6">
              <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                {/* Animated Badge */}
                {!user && (
                  <AnimatedGroup variants={transitionVariants}>
                    <motion.div
                      className="hover:bg-white/10 group mx-auto flex w-fit items-center gap-4 rounded-full border border-white/20 bg-white/10 p-1 pl-4 shadow-md transition-colors duration-300 cursor-pointer"
                      variants={transitionVariants.item}
                      onClick={() => window.open('https://x.com/serafimcloud/status/1934724044773052428', '_blank')}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                        <span className="text-white text-sm font-medium">Meet Phion</span>
                      </div>
                      <span className="block h-4 w-0.5 border-l bg-white/50"></span>

                      <div className="bg-white/20 group-hover:bg-white/30 size-6 overflow-hidden rounded-full duration-500">
                        <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                          <span className="flex size-6">
                            <ArrowRight className="m-auto size-3 text-white" />
                          </span>
                          <span className="flex size-6">
                            <ArrowRight className="m-auto size-3 text-white" />
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatedGroup>
                )}

                {/* Main Headlines */}
                <TextEffect
                  preset="fade-in-blur"
                  per="word"
                  speedReveal={0.8}
                  speedSegment={0.6}
                  delay={0.3}
                  as="h1"
                  className="mt-8 text-balance text-6xl md:text-7xl lg:mt-16 xl:text-[5.25rem] text-white font-normal leading-[1.1] tracking-tight"
                >
                  Full-power AI coding.
                </TextEffect>

                <TextEffect
                  preset="fade-in-blur"
                  per="word"
                  speedReveal={0.8}
                  speedSegment={0.6}
                  delay={0.6}
                  as="h1"
                  className="text-balance text-6xl md:text-7xl xl:text-[5.25rem] text-white font-normal leading-[1.1] tracking-tight"
                >
                  Zero setup.
                </TextEffect>

                <TextEffect
                  preset="slide"
                  per="line"
                  speedReveal={0.8}
                  speedSegment={0.6}
                  delay={1.2}
                  as="p"
                  className="mx-auto mt-8 max-w-2xl text-balance text-lg md:text-xl text-white/70 leading-relaxed font-normal"
                >
                  Focus on craft, not configs.
                </TextEffect>

                {/* Video Demo Section */}
                <div className="mt-16 lg:mt-24 max-w-5xl mx-auto">
                  <MorphingDialog
                    transition={{
                      duration: 0.3,
                      ease: "easeInOut",
                    }}
                  >
                    <MorphingDialogTrigger>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 1.8 }}
                        className="relative cursor-pointer group"
                      >
                        <Mockup>
                          <MockupFrame>
                            <div className="aspect-video bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-lg overflow-hidden relative">
                              <img
                                src="/phion-preview.png"
                                alt="Phion Demo Preview"
                                className="w-full h-full object-cover object-top"
                                onLoad={() => setIsVideoReadyToPlay(true)}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent group-hover:from-black/30 transition-all duration-300" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 group-hover:bg-white/30 transition-all duration-300">
                                  <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                                </div>
                              </div>
                            </div>
                          </MockupFrame>
                        </Mockup>
                      </motion.div>
                    </MorphingDialogTrigger>

                    <MorphingDialogContainer>
                      <MorphingDialogContent className="relative">
                        <MorphingDialogVideo
                          src="/phion-demo.mp4"
                          className="h-auto w-full max-w-[90vw] rounded-[4px] object-cover lg:h-[90vh]"
                          autoPlay
                          muted
                          controls
                        />
                        <MorphingDialogClose
                          className="fixed right-6 top-6 h-fit w-fit rounded-full bg-white p-1"
                          variants={{
                            initial: { opacity: 0 },
                            animate: {
                              opacity: 1,
                              transition: { delay: 0.3, duration: 0.1 },
                            },
                            exit: { opacity: 0, transition: { duration: 0 } },
                          }}
                        >
                          <X className="h-5 w-5 text-zinc-500" />
                        </MorphingDialogClose>
                      </MorphingDialogContent>
                    </MorphingDialogContainer>
                  </MorphingDialog>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <FeaturesSection />

        {/* FAQ Section */}
        <FAQSection />
      </main>
    </>
  )
}
