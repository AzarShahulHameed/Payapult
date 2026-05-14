// frontend/src/hooks/useData.js
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

// Generic data fetching hook
export function useFetch(fetcher, deps = [], options = {}) {
  const [data, setData] = useState(options.initial || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      setData(res.data.data || res.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// Mutation hook
export function useMutation(mutator, options = {}) {
  const [loading, setLoading] = useState(false);

  const mutate = async (...args) => {
    setLoading(true);
    try {
      const res = await mutator(...args);
      if (options.successMsg) toast.success(options.successMsg);
      if (options.onSuccess) options.onSuccess(res.data);
      return res.data;
    } catch (err) {
      if (options.onError) options.onError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading };
}

// Pagination hook
export function usePagination(fetcher, initialParams = {}) {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [params, setParams] = useState(initialParams);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetcher({ ...params, page: pagination.page, limit: pagination.limit });
      setData(res.data.data);
      if (res.data.pagination) setPagination(p => ({ ...p, ...res.data.pagination }));
    } catch (_) {} finally {
      setLoading(false);
    }
  }, [params, pagination.page]);

  useEffect(() => { fetch(); }, [fetch]);

  const setPage = (page) => setPagination(p => ({ ...p, page }));
  const updateParams = (newParams) => { setParams(p => ({ ...p, ...newParams })); setPagination(p => ({ ...p, page: 1 })); };

  return { data, pagination, loading, setPage, updateParams, refetch: fetch };
}
