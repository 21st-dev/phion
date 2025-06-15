import { useMutation, useQueryClient } from "@tanstack/react-query"

interface UpdateProjectSettingsParams {
  projectId: string
  name: string
}

async function updateProjectSettings({ projectId, name }: UpdateProjectSettingsParams) {
  const response = await fetch(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    throw new Error("Failed to save settings")
  }

  return response.json()
}

export function useUpdateProjectSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProjectSettings,
    onSuccess: () => {
      // Обновляем кеш проектов после успешного обновления
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}
