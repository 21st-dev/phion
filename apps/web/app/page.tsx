import { ProjectList } from "@/components/project-list";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { Header } from "@/components/layout/header";
import { createAuthServerClient } from "@shipvibes/database";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
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
        // Игнорируем ошибки установки cookies в Server Components
      }
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Если пользователь не авторизован, перенаправляем на страницу входа
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background-100">
      <Header user={user} />

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
                  deployed instantly.
                </p>
              </div>
              <CreateProjectDialog />
            </div>

            {/* Projects */}
            <ProjectList />
          </div>
        </div>
      </main>
    </div>
  );
}
