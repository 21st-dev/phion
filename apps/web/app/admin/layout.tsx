import { createAuthServerClient } from "@shipvibes/database"
import { cookies } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"

function AdminNavigation() {
  return (
    <nav className="flex space-x-4 ml-6">
      <Link
        href="/admin/usage"
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Usage Dashboard
      </Link>
      <Link
        href="/admin/waitlist"
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Waitlist
      </Link>
    </nav>
  )
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createAuthServerClient({
    getAll() {
      return cookieStore.getAll()
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      } catch {
        // Игнорируем ошибки установки cookies
      }
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Проверяем, авторизован ли пользователь
  if (!user) {
    redirect("/login")
  }

  // Проверяем, является ли пользователь админом
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (userError || !userData || !userData.is_admin) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex items-center">
            <h1 className="text-lg font-semibold">Admin Panel</h1>
            <AdminNavigation />
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="text-sm text-muted-foreground">Logged in as: {user.email}</div>
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}
