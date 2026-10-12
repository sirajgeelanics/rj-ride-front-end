import React, { Suspense, lazy, useMemo, type ComponentType, type ReactNode } from "react";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useSearchParams as useRouterSearchParams,
  type LinkProps,
} from "react-router-dom";

/** Thin adapter so pages keep the `href` / `usePathname` / `useRouter` shapes they were written with. */
export function Link({ href, ...rest }: Omit<LinkProps, "to"> & { href: string }) {
  return <RouterLink to={href} {...rest} />;
}

export const usePathname = () => useLocation().pathname;

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (url: string) => navigate(url),
      replace: (url: string) => navigate(url, { replace: true }),
    }),
    [navigate],
  );
}

export const useSearchParams = () => useRouterSearchParams()[0];

/** Client-only lazy component (replaces next/dynamic with ssr:false). */
export function dynamic<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  opts?: { loading?: () => ReactNode; ssr?: boolean },
) {
  const Lazy = lazy(loader);
  return function DynamicComponent(props: P) {
    return (
      <Suspense fallback={opts?.loading ? opts.loading() : null}>
        <Lazy {...(props as P & React.JSX.IntrinsicAttributes)} />
      </Suspense>
    );
  };
}
