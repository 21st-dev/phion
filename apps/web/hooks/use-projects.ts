import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { ProjectRow } from "@shipvibes/database"

async function fetchProjects(): Promise<ProjectRow[]> {
  const response = await fetch("/api/projects")
  if (!response.ok) {
    throw new Error("Failed to fetch projects")
  }
  return response.json()
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnWindowFocus: false,
  })
}

// Хук для инвалидации кеша проектов (для использования после создания/удаления проектов)
export function useInvalidateProjects() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] })
    queryClient.invalidateQueries({ queryKey: ["project-limits"] })
  }
}
