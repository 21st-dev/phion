"use client";

import { useState } from "react";
import { createAuthBrowserClient } from "@shipvibes/database";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface UserMenuProps {
  user: User;
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createAuthBrowserClient();
  const router = useRouter();

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error.message);
        alert("Error signing out: " + error.message);
      } else {
        router.push("/login");
        router.refresh();
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      alert("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = user.user_metadata?.full_name || user.email || "User";
  const avatar = user.user_metadata?.avatar_url;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
      >
        {avatar ? (
          <img
            src={avatar}
            alt={displayName}
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="hidden sm:block">{displayName}</span>
        <svg
          className={`w-4 h-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="m19 9-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="py-1">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{displayName}</p>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
            </div>

            <button
              onClick={handleSignOut}
              disabled={isLoading}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-700 mr-2"></div>
                  Signing out...
                </div>
              ) : (
                "Sign out"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Click outside overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
