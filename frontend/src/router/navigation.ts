import { useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams, useSearchParams as useRouterSearchParams } from "react-router-dom";

export { useParams };

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  const [searchParams] = useRouterSearchParams();
  return searchParams;
}

export function useRouter() {
  const navigate = useNavigate();
  const push = useCallback((path: string) => navigate(path), [navigate]);
  const replace = useCallback((path: string) => navigate(path, { replace: true }), [navigate]);
  const back = useCallback(() => navigate(-1), [navigate]);
  const refresh = useCallback(() => navigate(0), [navigate]);

  return useMemo(() => ({ push, replace, back, refresh }), [push, replace, back, refresh]);
}
