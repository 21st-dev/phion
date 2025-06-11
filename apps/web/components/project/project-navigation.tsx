"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ProjectNavigationProps {
  projectId: string;
  project?: any; // Проект с данными для определения показывать ли онбординг
}

export function ProjectNavigation({
  projectId,
  project,
}: ProjectNavigationProps) {
  // Скрываем Onboarding если уже есть netlify_site_id (первый деплой был сделан)
  const showOnboarding = !project?.netlify_site_id;

  const tabs = [
    { id: "overview", label: "Overview", href: "overview" },
    ...(showOnboarding
      ? [{ id: "onboarding", label: "Onboarding", href: "onboarding" }]
      : []),
    { id: "settings", label: "Settings", href: "settings" },
  ];
  const pathname = usePathname();

  // Extract current tab from pathname
  const currentTab = pathname.split("/").pop() || "overview";

  return (
    <div className="flex space-x-6">
      {tabs.map((tab) => {
        const isActive = currentTab === tab.href;

        return (
          <Link
            key={tab.id}
            href={`/project/${projectId}/${tab.href}`}
            className={cn(
              "pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
