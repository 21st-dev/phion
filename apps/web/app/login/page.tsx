"use client";

import { useState } from "react";
import { createAuthBrowserClient } from "@shipvibes/database";
import { Button } from "@/components/geist/button";
import { Material } from "@/components/geist/material";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createAuthBrowserClient();

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
        alert("Login failed: " + error.message);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-100">
      <div className="max-w-md w-full px-4">
        <Material className="p-8">
          <div className="text-center space-y-6">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-md bg-gray-1000 flex items-center justify-center">
                <span className="text-background-100 font-bold text-xl">S</span>
              </div>
            </div>

            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-gray-1000">
                Welcome to Shipvibes
              </h1>
              <p className="text-gray-700">
                Edit frontend code locally with automatic deployment
              </p>
            </div>

            {/* Login Button */}
            <div className="pt-4">
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
                {isLoading ? "Signing in..." : "Continue with Google"}
              </Button>
            </div>

            {/* Terms */}
            <p className="text-xs text-gray-600">
              By signing in, you agree to our Terms of Service and Privacy
              Policy
            </p>
          </div>
        </Material>
      </div>
    </div>
  );
}
