import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check if this is a user dashboard route ([user_id])
  const userDashboardMatch = request.nextUrl.pathname.match(/^\/([^\/]+)$/)
  const isUserDashboard =
    userDashboardMatch && userDashboardMatch[1] !== "waitlist" && userDashboardMatch[1] !== "admin"

  // Защищенные роуты - перенаправляем на главную если не авторизован
  if (
    !user &&
    (request.nextUrl.pathname.startsWith("/project") ||
      request.nextUrl.pathname.startsWith("/waitlist") ||
      isUserDashboard)
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  // Check if user is in waitlist and approved
  if (user && !request.nextUrl.pathname.startsWith("/waitlist")) {
    // Skip these paths
    const publicPaths = ["/auth/callback", "/logout", "/api/", "/admin", "/debug-waitlist"]
    const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path))
    const isHomePage = request.nextUrl.pathname === "/"

    if (!isPublicPath && !isHomePage) {
      // Check if user is approved in waitlist
      const { data: waitlistEntry, error } = await supabase
        .from("waitlist")
        .select("*")
        .eq("email", user.email)
        .single()

      // If no waitlist entry or error, redirect to waitlist
      if (error || !waitlistEntry) {
        const url = request.nextUrl.clone()
        url.pathname = "/waitlist"
        return NextResponse.redirect(url)
      }

      // If waitlist entry exists but user is not approved, redirect to waitlist
      // Handle missing status field (legacy entries)
      const status = waitlistEntry.status || "pending"
      if (status !== "approved") {
        const url = request.nextUrl.clone()
        url.pathname = "/waitlist"
        return NextResponse.redirect(url)
      }
    }
  }

  // Если пользователь авторизован и находится на главной странице, проверяем статус waitlist
  if (user && request.nextUrl.pathname === "/") {
    // Check if user is approved in waitlist
    const { data: waitlistEntry, error } = await supabase
      .from("waitlist")
      .select("*")
      .eq("email", user.email)
      .single()

    // If user is approved, redirect to their dashboard
    if (!error && waitlistEntry) {
      const status = waitlistEntry.status || "pending"
      if (status === "approved") {
        const url = request.nextUrl.clone()
        url.pathname = `/${user.id}`
        return NextResponse.redirect(url)
      }
    }
    // If not approved or no waitlist entry, stay on home page to show waitlist status
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object here instead of the supabaseResponse object

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
