"use client";

import { useState } from "react";
import { createAuthBrowserClient } from "@shipvibes/database";
import { Button } from "@/components/geist/button";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createAuthBrowserClient();
  const { error: showError } = useToast();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error("Error during Google login:", error.message);
        showError("Login failed", error.message);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      showError("Login failed", "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-16">
        {/* Logo */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-black flex items-center justify-center">
            <span className="text-white font-light text-2xl">V</span>
          </div>
        </div>

        {/* Main Message */}
        <div className="text-center space-y-8">
          <h1 className="text-4xl font-extralight text-gray-900 tracking-tight leading-tight">
            Vybcel - Vibecode OS
          </h1>

          <p className="text-lg font-light text-gray-600 leading-relaxed">
            Just craft in Cursor.
            <br />
            We handle everything else.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center space-y-6">
          <Button
            type="primary"
            size="large"
            fullWidth={true}
            loading={isLoading}
            onClick={handleGoogleLogin}
            prefix={
              !isLoading ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              ) : undefined
            }
          >
            {isLoading ? "..." : "Continue with Google"}
          </Button>

          <p className="text-xs font-light text-gray-400">
            By continuing, you agree to our terms
          </p>
        </div>
      </div>
    </div>
  );
}
