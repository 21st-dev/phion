import { redirect } from "next/navigation"
import { createAuthServerClient } from "@shipvibes/database"
import { cookies } from "next/headers"

const ADMIN_USER_ID = "28a1b02f-d1a1-4ca4-968f-ab186dcb59e0"

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

  // Проверяем, авторизован ли пользователь и является ли он админом
  if (!user || user.id !== ADMIN_USER_ID) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <h1 className="text-lg font-semibold">Admin Panel</h1>
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
