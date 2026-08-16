import { useEffect, useState } from "react";
import type { MaterialListResponse } from "../../shared/types";
import { listMaterials } from "../lib/api";

export interface MaterialsQuery {
  search?: string;
  categoryId?: number;
  page: number;
  pageSize: number;
}

export function useMaterials(query: MaterialsQuery) {
  const { search, categoryId, page, pageSize } = query;
  const [data, setData] = useState<MaterialListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMaterials({ search, categoryId, page, pageSize })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "加载物料失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, categoryId, page, pageSize, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  return { data, loading, error, refresh };
}
