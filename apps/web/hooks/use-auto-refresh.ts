"use client";

import { useQuery } from "@tanstack/react-query";

interface UseAutoRefreshOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useAutoRefresh<T>(
  queryKey: string[],
  fetchFunction: () => Promise<T>,
  options: UseAutoRefreshOptions = {},
) {
  const {
    enabled = true,
    refetchInterval = false, // По умолчанию автообновление отключено
  } = options;

  const query = useQuery({
    queryKey,
    queryFn: fetchFunction,
    enabled,
    refetchInterval,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 30, // 30 секунд
  });

  return {
    data: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    refresh: query.refetch,
    isRefetching: query.isFetching && !query.isLoading,
  };
}
