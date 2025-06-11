"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectList } from "@/components/project-list";
import { DeleteAllProjectsDialog } from "@/components/project/delete-all-projects-dialog";
import { Header } from "@/components/layout/header";
import { createAuthBrowserClient } from "@shipvibes/database";
import type { User } from "@supabase/supabase-js";
import { CreateProjectButton } from "@/components/create-project-button";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();
  const supabase = createAuthBrowserClient();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);
      setLoading(false);
    };

    checkAuth();
  }, [router, supabase.auth]);

  const handleDeleteAllSuccess = () => {
    // Обновляем список проектов принудительно
    setRefreshKey((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-100 flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background-100">
      <div className="sticky top-0 z-50">
        <Header user={user} />
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col space-y-8">
            {/* Hero Section */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-gray-1000">
                  Your Projects
                </h1>
                <p className="text-gray-700">
                  Edit your frontend code locally in Cursor and see changes
                  published instantly.
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <CreateProjectButton />
                {/* Dev-only: Delete All Projects */}
                {process.env.NODE_ENV === "development" && (
                  <DeleteAllProjectsDialog
                    variant="button"
                    onSuccess={handleDeleteAllSuccess}
                  />
                )}
              </div>
            </div>

            {/* Projects */}
            <ProjectList key={refreshKey} />
          </div>
        </div>
      </main>
    </div>
  );
}
