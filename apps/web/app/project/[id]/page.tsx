import { redirect } from "next/navigation"
import { getProjectById } from "@shipvibes/database"

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params

  // Получаем данные проекта для определения нужен ли онбординг

  try {
    const project = await getProjectById(id)

    // Если у проекта нет netlify_site_id, значит онбординг еще не пройден
    if (!project?.netlify_site_id) {
      redirect(`/project/${id}/onboarding`)
    } else {
      // Онбординг пройден, идем на overview
      redirect(`/project/${id}/overview`)
    }
  } catch {
    // Если проект не найден или ошибка, идем на overview (там будет 404)
    redirect(`/project/${id}/overview`)
  }
}
