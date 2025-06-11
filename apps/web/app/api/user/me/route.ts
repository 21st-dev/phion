import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthServerClient } from "@shipvibes/database";

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from Supabase session
    const cookieStore = await cookies();
    const supabase = createAuthServerClient({
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore cookie setting errors in Server Components
        }
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("❌ Authentication error:", authError);
      return NextResponse.json(
        { 
          error: "Unauthorized",
          message: "User not authenticated"
        },
        { status: 401 }
      );
    }

    // Return real user data
    const userData = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.user_metadata?.full_name || "User",
      avatar_url: user.user_metadata?.avatar_url,
      // Add other user fields as needed
    };

    console.log("👤 User data requested for payment flow:", {
      id: userData.id,
      email: userData.email,
      hasName: !!userData.name
    });

    return NextResponse.json(userData);

  } catch (error) {
    console.error("❌ Error getting user data:", error);
    return NextResponse.json(
      { 
        error: "Failed to get user data",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 