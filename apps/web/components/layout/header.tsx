"use client"

import { Avatar } from "@/components/geist/avatar"
import { Button } from "@/components/geist/button"
import { ThemeSwitcher } from "@/components/geist/theme-switcher"
import { PricingModal } from "@/components/pricing-dialog"
import { Logo } from "@/components/brand"
import { useProjectLimits } from "@/hooks/use-project-limits"
import { useSupabase } from "@/lib/supabase/client"
import type { ProjectRow } from "@shipvibes/database"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

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
        <div className="flex h-16 items-center justify-between">
          {/* Logo и навигация */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Logo width={20} height={20} />
              <span className="text-gray-1000 font-semibold text-sm">Phion</span>
            </Link>

            {/* Показываем название проекта через слеш если проект передан */}
            {project && (
              <div className="flex items-center gap-1 ml-1">
                <SlashIcon />
                <span className="text-gray-700 font-medium text-sm">{project.name}</span>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
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
            <ThemeSwitcher />

            {user ? (
              <div className="flex items-center space-x-3">
                <Avatar
                  src={user.user_metadata?.avatar_url}
                  name={user.user_metadata?.name || user.email}
                  size={32}
                />
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-1000">
                    {user.user_metadata?.name || user.email}
                  </p>
                </div>
                <Button type="secondary" size="small" onClick={handleSignOut}>
                  Sign out
                </Button>
              </div>
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
