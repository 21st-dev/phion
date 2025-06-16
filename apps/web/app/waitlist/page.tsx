import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import WaitlistPageClient from "./page.client"

export default async function WaitlistPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/")
  }

  const userEmail = user.email || ""
  const userName = user.user_metadata?.full_name || user.user_metadata?.name || "User"

  return (
    <div className="relative">
      <WaitlistPageClient userEmail={userEmail} userName={userName} />
    </div>
  )
}
