import { useQuery } from "@tanstack/react-query"

interface SubscriptionData {
  hasActiveSubscription: boolean
  email: string
  planType?: string
  subscriptionStatus?: string
  subscriptionEndDate?: string
  isExpired?: boolean
  error?: string
}

interface ProjectLimitsData {
  projectCount: number
  subscriptionData: SubscriptionData
}

interface ProjectLimits {
  isLoading: boolean
  canCreateProject: boolean
  hasActiveSubscription: boolean
  projectCount: number
  maxProjects: number
  subscriptionData: SubscriptionData | null
  currentPlan: string
  currentPlanName: string
  error: string | null
  refetch: () => void
}

const FREE_TIER_LIMIT = 1

async function fetchProjectLimits(): Promise<ProjectLimitsData> {
  // Параллельно загружаем проекты и подписку
  const [projectsResponse, subscriptionResponse] = await Promise.all([
    fetch("/api/projects"),
    fetch("/api/subscription/check"),
  ])

  if (!projectsResponse.ok) {
    throw new Error("Failed to fetch projects")
  }

  const projects = await projectsResponse.json()
  const projectCount = Array.isArray(projects) ? projects.length : 0

  let subscriptionData: SubscriptionData = {
    hasActiveSubscription: false,
    email: "",
    error: "Subscription check failed",
  }

  if (subscriptionResponse.ok) {
    try {
      subscriptionData = await subscriptionResponse.json()
    } catch (parseError) {
      // JSON parsing failed, default to free tier
      console.warn("Failed to parse subscription response, defaulting to free tier")
    }
  } else {
    // Если проверка подписки не удалась, считаем что подписки нет
    console.warn("Subscription check failed, defaulting to free tier")
  }

  return { projectCount, subscriptionData }
}

export function useProjectLimits(): ProjectLimits {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["project-limits"],
    queryFn: fetchProjectLimits,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Retry only for network errors, not for project fetch failures
      if (error?.message?.includes("Failed to fetch projects")) {
        return false
      }
      return failureCount < 2
    },
  })

  const projectCount = data?.projectCount || 0
  const subscriptionData = data?.subscriptionData || null
  const hasActiveSubscription = subscriptionData?.hasActiveSubscription || false

  // В development окружении убираем лимиты
  const isDevelopment = process.env.NODE_ENV === "development"
  const maxProjects = hasActiveSubscription || isDevelopment ? Infinity : FREE_TIER_LIMIT
  const canCreateProject = isDevelopment || projectCount < maxProjects

  const currentPlan = subscriptionData?.planType || "free"
  const currentPlanName = currentPlan
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")

  return {
    isLoading,
    canCreateProject,
    hasActiveSubscription: hasActiveSubscription || isDevelopment,
    projectCount,
    maxProjects: hasActiveSubscription || isDevelopment ? -1 : FREE_TIER_LIMIT, // -1 означает безлимитный
    subscriptionData,
    error: error?.message || null,
    currentPlan: currentPlan,
    currentPlanName: currentPlanName,
    refetch: () => {
      refetch()
    },
  }
}
