import { lazy, Suspense, type ComponentType } from "react";

type DynamicOptions = {
  loading?: ComponentType;
  ssr?: boolean;
};

export default function dynamic<Props extends object>(
  loader: () => Promise<{ default: ComponentType<Props> }>,
  options: DynamicOptions = {},
) {
  const LazyComponent = lazy(loader);

  function DynamicComponent(props: Props) {
    const Loading = options.loading;
    return (
      <Suspense fallback={Loading ? <Loading /> : null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  }

  return DynamicComponent;
}
