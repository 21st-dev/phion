import { redirect } from "next/navigation";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;

  // Redirect to overview by default
  redirect(`/project/${id}/overview`);
}
