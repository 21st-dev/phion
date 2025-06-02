import { ProjectList } from "@/components/project-list";
import { CreateProjectButton } from "@/components/create-project-button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          <div className="mr-4 flex">
            <a className="mr-6 flex items-center space-x-2" href="/">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <span className="text-sm font-bold">S</span>
              </div>
              <span className="font-bold">Shipvibes</span>
            </a>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <p className="text-sm text-muted-foreground md:hidden">
                Frontend code editor with auto-deploy
              </p>
            </div>
            <nav className="flex items-center">
              <CreateProjectButton />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container py-6">
          <div className="flex flex-col space-y-8">
            {/* Hero Section */}
            <div className="flex flex-col space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Ship frontend code with auto-deploy
                </h1>
                <p className="text-lg text-muted-foreground">
                  Edit your frontend code locally in Cursor and see changes
                  deployed instantly. No configuration required.
                </p>
              </div>
            </div>

            {/* Projects */}
            <ProjectList />
          </div>
        </div>
      </main>
    </div>
  );
}
