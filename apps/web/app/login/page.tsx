"use client";

import { useState } from "react";
import { createAuthBrowserClient } from "@shipvibes/database";
import { Button } from "@/components/geist/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import React from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const Logo = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const baseClasses =
    "w-16 h-16 mx-auto rounded-full flex items-center justify-center text-foreground";
  const themeClasses = !isDark
    ? cn(
        "bg-[radial-gradient(61.35%_50.07%_at_48.58%_50%,rgb(255,255,255)_0%,rgb(235,235,235)_100%)]",
        "[box-shadow:inset_0_0_0_0.5px_hsl(var(--border)),inset_1px_1px_0_-0.5px_hsl(var(--border)),inset_-1px_-1px_0_-0.5px_hsl(var(--border))]"
      )
    : cn(
        "bg-[radial-gradient(61.35%_50.07%_at_48.58%_50%,rgb(36,36,36)_0%,rgb(0,0,0)_100%)]",
        "[box-shadow:inset_0_0_0_0.5px_rgba(134,143,151,0.2),inset_1px_1px_0_-0.5px_rgba(134,143,151,0.4),inset_-1px_-1px_0_-0.5px_rgba(134,143,151,0.4)]"
      );

  return (
    <div className={cn(baseClasses, themeClasses)}>
      <span className="font-light text-2xl text-foreground">V</span>
    </div>
  );
};

interface StyledButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
}

const StyledButton: React.FC<StyledButtonProps> = ({
  loading,
  children,
  ...props
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <button
      disabled={props.disabled || loading}
      {...props}
      className={cn(
        "group relative flex items-center justify-center gap-2 w-full h-12 rounded-[28px] px-4 py-2 text-sm font-semibold leading-tight",
        "whitespace-nowrap",
        "text-foreground",
        isDark
          ? "bg-[radial-gradient(61.35%_50.07%_at_48.58%_50%,rgb(0,0,0)_0%,rgba(255,255,255,0.04)_100%)] [box-shadow:inset_0_0_0_0.5px_rgba(134,143,151,0.2),inset_1px_1px_0_-0.5px_rgba(134,143,151,0.4),inset_-1px_-1px_0_-0.5px_rgba(134,143,151,0.4)]"
          : "bg-[radial-gradient(61.35%_50.07%_at_48.58%_50%,rgb(255,255,255)_0%,rgba(0,0,0,0.02)_100%)] [box-shadow:inset_0_0_0_0.5px_hsl(var(--border)),inset_1px_1px_0_-0.5px_hsl(var(--border)),inset_-1px_-1px_0_-0.5px_hsl(var(--border))]",
        "after:absolute after:inset-0 after:rounded-[28px] after:opacity-0 after:transition-opacity after:duration-200",
        isDark
          ? "after:bg-[radial-gradient(61.35%_50.07%_at_48.58%_50%,rgb(0,0,0)_0%,rgb(24,24,24)_100%)] after:[box-shadow:inset_0_0_0_0.5px_hsl(var(--border)),inset_1px_1px_0_-0.5px_hsl(var(--border)),inset_-1px_-1px_0_-0.5px_hsl(var(--border)),0_0_3px_rgba(255,255,255,0.1)]"
          : "after:bg-[radial-gradient(61.35%_50.07%_at_48.58%_50%,rgb(255,255,255)_0%,rgb(242,242,242)_100%)] after:[box-shadow:inset_0_0_0_0.5px_hsl(var(--border)),inset_1px_1px_0_-0.5px_hsl(var(--border)),inset_-1px_-1px_0_-0.5px_hsl(var(--border)),0_0_3px_hsl(var(--ring))]",
        "hover:after:opacity-20 disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      <span className="relative z-10 flex items-center gap-2">
        {loading ? (
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            ></path>
          </svg>
        ) : (
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
        )}
        {children}
      </span>
    </button>
  );
};

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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative">
      <div className="w-full max-w-sm space-y-16">
        {/* Logo */}
        <div className="text-center">
          <Logo />
        </div>

        {/* Main Message */}
        <div className="text-center space-y-8">
          <h1 className="text-4xl font-extralight text-foreground tracking-tight leading-tight">
            Vybcel - Vibecode OS
          </h1>

          <p className="text-lg font-light text-muted-foreground leading-relaxed">
            Just craft in Cursor.
            <br />
            We handle everything else.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center space-y-6">
          <StyledButton loading={isLoading} onClick={handleGoogleLogin}>
            {isLoading ? "" : "Continue with Google"}
          </StyledButton>

          <p className="text-xs font-light text-muted-foreground">
            By continuing, you agree to our terms
          </p>
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="fixed bottom-6 right-6">
        <ThemeToggle />
      </div>
    </div>
  );
}
