import { useState, useEffect } from "react";

interface SubscriptionData {
  hasActiveSubscription: boolean;
  email: string;
  planType?: string;
  subscriptionStatus?: string;
  subscriptionEndDate?: string;
  isExpired?: boolean;
  error?: string;
}

interface ProjectLimits {
  isLoading: boolean;
  canCreateProject: boolean;
  hasActiveSubscription: boolean;
  projectCount: number;
  maxProjects: number;
  subscriptionData: SubscriptionData | null;
  error: string | null;
  refreshLimits: () => Promise<void>;
}

const FREE_TIER_LIMIT = 1;

export function useProjectLimits(): ProjectLimits {
  const [isLoading, setIsLoading] = useState(true);
  const [projectCount, setProjectCount] = useState(0);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLimits = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Параллельно загружаем проекты и подписку
      const [projectsResponse, subscriptionResponse] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/subscription/check")
      ]);

      if (!projectsResponse.ok) {
        throw new Error("Failed to fetch projects");
      }

      const projects = await projectsResponse.json();
      setProjectCount(Array.isArray(projects) ? projects.length : 0);

      if (subscriptionResponse.ok) {
        try {
          const subscription = await subscriptionResponse.json();
          setSubscriptionData(subscription);
        } catch (parseError) {
          // JSON parsing failed, default to free tier
          console.warn("Failed to parse subscription response, defaulting to free tier");
          setSubscriptionData({
            hasActiveSubscription: false,
            email: "",
            error: "Subscription check failed"
          });
        }
      } else {
        // Если проверка подписки не удалась, считаем что подписки нет
        console.warn("Subscription check failed, defaulting to free tier");
        setSubscriptionData({
          hasActiveSubscription: false,
          email: "",
          error: "Subscription check failed"
        });
      }
    } catch (err) {
      // Only set error for critical failures (like projects fetch failing)
      if (err instanceof Error && err.message.includes("Failed to fetch projects")) {
        setError(err.message);
      } else {
        // For other errors, just log and continue with free tier
        console.warn("Non-critical error in fetchLimits:", err);
      }
      
      // В случае ошибки считаем, что подписки нет
      setSubscriptionData({
        hasActiveSubscription: false,
        email: "",
        error: err instanceof Error ? err.message : "Unknown error"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLimits();
  }, []);

  const hasActiveSubscription = subscriptionData?.hasActiveSubscription || false;
  const maxProjects = hasActiveSubscription ? Infinity : FREE_TIER_LIMIT;
  const canCreateProject = projectCount < maxProjects;

  return {
    isLoading,
    canCreateProject,
    hasActiveSubscription,
    projectCount,
    maxProjects: hasActiveSubscription ? -1 : FREE_TIER_LIMIT, // -1 означает безлимитный
    subscriptionData,
    error,
    refreshLimits: fetchLimits
  };
} 