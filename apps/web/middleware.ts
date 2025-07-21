import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

function handleUnauthorizedAccess(
  request: NextRequest,
  isAPIRoute: boolean,
  message: string = "Forbidden - Admin access required",
  status: number = 401,
) {
  if (isAPIRoute) {
    return NextResponse.json({ error: message }, { status })
  } else {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
}

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

  // Check if this is an admin route (frontend or API)
  const isAdminRoute =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/api/admin")
  const isAPIRoute = request.nextUrl.pathname.startsWith("/api/admin")

  // Admin route protection
  if (isAdminRoute) {
    // Check if user is authenticated
    if (!user) {
      return handleUnauthorizedAccess(
        request,
        isAPIRoute,
        "Unauthorized - Authentication required",
        401,
      )
    }

    // Check if user is admin by querying the users table
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", user.id)
        .single()

      if (userError || !userData || !userData.is_admin) {
        return handleUnauthorizedAccess(
          request,
          isAPIRoute,
          "Forbidden - Admin access required",
          403,
        )
      }
    } catch (error) {
      console.error("Error checking admin status:", error)
      return handleUnauthorizedAccess(request, isAPIRoute, "Internal server error", 500)
    }
  }

  // Check if this is a user dashboard route ([user_id])
  const userDashboardMatch = request.nextUrl.pathname.match(/^\/([^\/]+)$/)
  const isUserDashboard = userDashboardMatch && userDashboardMatch[1] !== "admin"

  // Protected routes - redirect to login if not authenticated
  if (!user && (request.nextUrl.pathname.startsWith("/project") || isUserDashboard)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // If user is authenticated and on main page, redirect to dashboard
  if (user && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = `/${user.id}`
    return NextResponse.redirect(url)
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)",
  ],
}
