"use client"

import { Avatar } from "@/components/geist/avatar"
import { Button } from "@/components/geist/button"
import { PricingModal } from "@/components/pricing-dialog"
import { Logo } from "@/components/brand"
import { useProjectLimits } from "@/hooks/use-project-limits"
import { useSupabase } from "@/lib/supabase/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ProjectRow } from "@shipvibes/database"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useTheme } from "next-themes"
import { LogOut } from "lucide-react"

interface HeaderProps {
  user?: {
    email?: string
    user_metadata?: {
      name?: string
      avatar_url?: string
    }
  }
  project?: ProjectRow
}

// Slash icon component
const SlashIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-gray-alpha-400">
    <path
      d="M16.88 3.549L7.12 20.451"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

export function Header({ user, project }: HeaderProps) {
  const supabase = useSupabase()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [showPricingModal, setShowPricingModal] = useState(false)
  const { hasActiveSubscription, projectCount, maxProjects, isLoading, currentPlanName } =
    useProjectLimits()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <header className="bg-background-100">
      <div className="px-4 ">
        <div className="flex py-2 items-center justify-between">
          {/* Logo and navigation */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Logo width={22} height={22} />
              <span className="text-gray-1000 font-semibold text-sm">Phion</span>
            </Link>

            {/* Show project name with slash if project provided */}
            {project && (
              <div className="flex items-center gap-1 ml-1">
                <SlashIcon />
                <span className="text-gray-700 font-medium text-sm">{project.name}</span>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4 max-h-[32px] justify-center">
            {user && !isLoading && (
              <div className="hidden sm:block">
                <span
                  className="cursor-pointer hover:opacity-80 transition-opacity text-sm "
                  onClick={() => setShowPricingModal(true)}
                >
                  {projectCount}/{maxProjects} {currentPlanName}
                </span>
              </div>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="cursor-pointer rounded-full">
                  <Avatar
                    src={user.user_metadata?.avatar_url}
                    name={user.user_metadata?.name || user.email}
                    size={28}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[240px] p-0" align="end">
                  <div className="p-2 border-b border-border">
                    <p className="text-sm text-foreground">{user.email}</p>
                  </div>

                  <div className="p-1">
                    <div className="flex items-center justify-between px-3 py-1 text-sm">
                      <span>Theme</span>
                      <fieldset className="flex items-center h-6 rounded-full border border-border/40 bg-background">
                        <legend className="sr-only">Select a display theme:</legend>
                        <span>
                          <input
                            type="radio"
                            id="theme-switch-light"
                            value="light"
                            name="theme"
                            className="sr-only peer"
                            checked={theme === "light"}
                            onChange={() => setTheme("light")}
                          />
                          <label
                            htmlFor="theme-switch-light"
                            className="inline-flex items-center justify-center rounded-full p-0.5 h-6 w-6 text-sm cursor-pointer text-muted-foreground hover:text-foreground peer-checked:bg-accent peer-checked:text-foreground"
                          >
                            <span className="sr-only">light</span>
                            <svg
                              height="10"
                              strokeLinejoin="round"
                              viewBox="0 0 16 16"
                              width="10"
                              className="h-2.5 w-2.5"
                            >
                              <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                fill="currentColor"
                                d="M8.75 0.75V0H7.25V0.75V2V2.75H8.75V2V0.75ZM11.182 3.75732L11.7123 3.22699L12.0659 2.87344L12.5962 2.34311L13.6569 3.40377L13.1265 3.9341L12.773 4.28765L12.2426 4.81798L11.182 3.75732ZM8 10.5C9.38071 10.5 10.5 9.38071 10.5 8C10.5 6.61929 9.38071 5.5 8 5.5C6.61929 5.5 5.5 6.61929 5.5 8C5.5 9.38071 6.61929 10.5 8 10.5ZM8 12C10.2091 12 12 10.2091 12 8C12 5.79086 10.2091 4 8 4C5.79086 4 4 5.79086 4 8C4 10.2091 5.79086 12 8 12ZM13.25 7.25H14H15.25H16V8.75H15.25H14H13.25V7.25ZM0.75 7.25H0V8.75H0.75H2H2.75V7.25H2H0.75ZM2.87348 12.0659L2.34315 12.5962L3.40381 13.6569L3.93414 13.1265L4.28769 12.773L4.81802 12.2426L3.75736 11.182L3.22703 11.7123L2.87348 12.0659ZM3.75735 4.81798L3.22702 4.28765L2.87347 3.9341L2.34314 3.40377L3.4038 2.34311L3.93413 2.87344L4.28768 3.22699L4.81802 3.75732L3.75735 4.81798ZM12.0659 13.1265L12.5962 13.6569L13.6569 12.5962L13.1265 12.0659L12.773 11.7123L12.2426 11.182L11.182 12.2426L11.7123 12.773L12.0659 13.1265ZM8.75 13.25V14V15.25V16H7.25V15.25V14V13.25H8.75Z"
                              />
                            </svg>
                          </label>
                        </span>
                        <span>
                          <input
                            type="radio"
                            id="theme-switch-system"
                            value="system"
                            name="theme"
                            className="sr-only peer"
                            checked={theme === "system"}
                            onChange={() => setTheme("system")}
                          />
                          <label
                            htmlFor="theme-switch-system"
                            className="inline-flex items-center justify-center rounded-full p-0.5 h-6 w-6 text-sm cursor-pointer text-muted-foreground hover:text-foreground peer-checked:bg-accent peer-checked:text-foreground"
                          >
                            <span className="sr-only">system</span>
                            <svg
                              height="10"
                              strokeLinejoin="round"
                              viewBox="0 0 16 16"
                              width="10"
                              className="h-2.5 w-2.5"
                            >
                              <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                fill="currentColor"
                                d="M1 3.25C1 1.45507 2.45507 0 4.25 0H11.75C13.5449 0 15 1.45507 15 3.25V15.25V16H14.25H1.75H1V15.25V3.25ZM4.25 1.5C3.2835 1.5 2.5 2.2835 2.5 3.25V14.5H13.5V3.25C13.5 2.2835 12.7165 1.5 11.75 1.5H4.25ZM4 4C4 3.44772 4.44772 3 5 3H11C11.5523 3 12 3.44772 12 4V10H4V4ZM9 13H12V11.5H9V13Z"
                              />
                            </svg>
                          </label>
                        </span>
                        <span>
                          <input
                            type="radio"
                            id="theme-switch-dark"
                            value="dark"
                            name="theme"
                            className="sr-only peer"
                            checked={theme === "dark"}
                            onChange={() => setTheme("dark")}
                          />
                          <label
                            htmlFor="theme-switch-dark"
                            className="inline-flex items-center justify-center rounded-full p-0.5 h-6 w-6 text-sm cursor-pointer text-muted-foreground hover:text-foreground peer-checked:bg-accent peer-checked:text-foreground"
                          >
                            <span className="sr-only">dark</span>
                            <svg
                              height="10"
                              strokeLinejoin="round"
                              viewBox="0 0 16 16"
                              width="10"
                              className="h-2.5 w-2.5"
                            >
                              <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                fill="currentColor"
                                d="M1.5 8.00005C1.5 5.53089 2.99198 3.40932 5.12349 2.48889C4.88136 3.19858 4.75 3.95936 4.75 4.7501C4.75 8.61609 7.88401 11.7501 11.75 11.7501C11.8995 11.7501 12.048 11.7454 12.1953 11.7361C11.0955 13.1164 9.40047 14.0001 7.5 14.0001C4.18629 14.0001 1.5 11.3138 1.5 8.00005ZM6.41706 0.577759C2.78784 1.1031 0 4.22536 0 8.00005C0 12.1422 3.35786 15.5001 7.5 15.5001C10.5798 15.5001 13.2244 13.6438 14.3792 10.9921L13.4588 9.9797C12.9218 10.155 12.3478 10.2501 11.75 10.2501C8.71243 10.2501 6.25 7.78767 6.25 4.7501C6.25 3.63431 6.58146 2.59823 7.15111 1.73217L6.41706 0.577759ZM13.25 1V1.75V2.75L14.25 2.75H15V4.25H14.25H13.25V5.25V6H11.75V5.25V4.25H10.75L10 4.25V2.75H10.75L11.75 2.75V1.75V1H13.25Z"
                              />
                            </svg>
                          </label>
                        </span>
                      </fieldset>
                    </div>
                  </div>

                  <div className="border-t border-border p-1">
                    <DropdownMenuItem
                      className="text-sm px-3 py-1.5 cursor-pointer flex justify-between items-center"
                      onSelect={() => window.open("https://discord.gg/j4ZMYnMeJN", "_blank")}
                    >
                      <span>Discord</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path d="M19.73 4.87a18.2 18.2 0 0 0-4.6-1.44c-.21.4-.4.8-.58 1.21-1.69-.25-3.4-.25-5.1 0-.18-.41-.37-.82-.59-1.2-1.6.27-3.14.75-4.6 1.43A19.04 19.04 0 0 0 .96 17.7a18.43 18.43 0 0 0 5.63 2.87c.46-.62.86-1.28 1.2-1.98-.65-.25-1.29-.55-1.9-.92.17-.12.32-.24.47-.37 3.58 1.7 7.7 1.7 11.28 0l.46.37c-.6.36-1.25.67-1.9.92.35.7.75 1.35 1.2 1.98 2.03-.63 3.94-1.6 5.64-2.87.47-4.87-.78-9.09-3.3-12.83ZM8.3 15.12c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2.02 1.02 2 2.26c0 1.25-.89 2.27-2 2.27Zm7.4 0c-1.1 0-2-1.02-2-2.27 0-1.24.88-2.26 2-2.26s2.02 1.02 2 2.26c0 1.25-.88 2.27-2 2.27Z" />
                      </svg>
                    </DropdownMenuItem>
                  </div>

                  <div className="border-t border-border p-1">
                    <DropdownMenuItem
                      onSelect={handleSignOut}
                      className="text-sm px-3 py-1.5 cursor-pointer flex justify-between items-center"
                    >
                      <span>Log Out</span>
                      <LogOut className="h-4 w-4" />
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button type="primary" size="small" onClick={() => router.push("/")}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Modal */}
      <PricingModal open={showPricingModal} onOpenChange={setShowPricingModal} />
    </header>
  )
}
