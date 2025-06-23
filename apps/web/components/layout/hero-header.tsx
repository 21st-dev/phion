"use client"

import React from "react"
import { Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Menu, X } from "lucide-react"
import { useScroll } from "motion/react"
import { AuthDialog } from "@/components/auth-dialog"

interface HeroHeaderProps {
  user?: any
  onSignOut?: () => void
  onGoogleLogin?: () => void
  onGitHubLogin?: () => void
  isLoading?: boolean
}

export function HeroHeader({
  user,
  onSignOut,
  onGoogleLogin,
  onGitHubLogin,
  isLoading = false,
}: HeroHeaderProps) {
  const [menuState, setMenuState] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const [authDialogOpen, setAuthDialogOpen] = React.useState(false)

  const { scrollYProgress } = useScroll()

  React.useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      setScrolled(latest > 0.05)
    })
    return () => unsubscribe()
  }, [scrollYProgress])

  return (
    <header>
      <nav
        data-state={menuState && "active"}
        className={cn(
          "fixed z-20 w-full transition-colors duration-150",
          scrolled && "bg-black backdrop-blur-3xl",
        )}
      >
        <div className="mx-auto max-w-5xl px-6 transition-all duration-300">
          <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
            <div className="flex w-full items-center justify-between gap-12 lg:w-auto">
              <div className="flex items-center space-x-2">
                <Logo width={24} height={24} forceDark={true} />
                <span className="font-medium text-white transition-colors">Phion</span>
                <span className="text-white/60 text-sm">by 21st.dev</span>
              </div>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState ? "Close Menu" : "Open Menu"}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
                data-state={menuState ? "active" : "inactive"}
              >
                <Menu className="data-[state=active]:rotate-180 data-[state=active]:scale-0 data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                <X className="data-[state=active]:rotate-0 data-[state=active]:scale-100 data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
              </button>
            </div>

            <div
              className={cn(
                "bg-black/80 mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border-white/10 p-6 shadow-2xl shadow-black/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none",
                menuState && "block lg:flex",
              )}
            >
              <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                {!user ? (
                  <Button
                    className="bg-white text-black hover:bg-white/90 hover:text-black"
                    variant="outline"
                    size="sm"
                    onClick={() => setAuthDialogOpen(true)}
                  >
                    <span>Open app</span>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={onSignOut}>
                    <span>Sign out</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        onGoogleLogin={() => {
          onGoogleLogin?.()
          setAuthDialogOpen(false)
        }}
        onGitHubLogin={() => {
          onGitHubLogin?.()
          setAuthDialogOpen(false)
        }}
        isLoading={isLoading}
      />
    </header>
  )
}
