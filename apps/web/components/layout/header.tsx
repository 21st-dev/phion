"use client";

import Link from "next/link";
import { ThemeSwitcher } from "@/components/geist/theme-switcher";
import { Avatar } from "@/components/geist/avatar";
import { Button } from "@/components/geist/button";
import { useSupabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { ProjectRow } from "@shipvibes/database";

interface HeaderProps {
  user?: {
    email?: string;
    user_metadata?: {
      name?: string;
      avatar_url?: string;
    };
  };
  project?: ProjectRow;
}

// Slash icon component
const SlashIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    className="text-gray-alpha-400"
  >
    <path
      d="M16.88 3.549L7.12 20.451"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export function Header({ user, project }: HeaderProps) {
  const supabase = useSupabase();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="border-b border-gray-alpha-400 bg-background-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo и навигация */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-md bg-gray-1000 flex items-center justify-center">
                <span className="text-background-100 font-bold text-sm">S</span>
              </div>
              <span className="text-gray-1000 font-semibold text-lg">
                Shipvibes
              </span>
            </Link>

            {/* Показываем название проекта через слеш если проект передан */}
            {project && (
              <div className="flex items-center gap-2 ml-2">
                <SlashIcon />
                <span className="text-gray-700 font-medium text-lg">
                  {project.name}
                </span>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            <ThemeSwitcher />

            {user ? (
              <div className="flex items-center space-x-3">
                <Avatar src={user.user_metadata?.avatar_url} size={32} />
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
              <Button
                type="primary"
                size="small"
                onClick={() => router.push("/login")}
              >
                Sign in
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
