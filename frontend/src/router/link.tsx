import { Link as RouterLink, type LinkProps as RouterLinkProps } from "react-router-dom";
import type { ComponentProps } from "react";

type CompatibilityLinkProps = Omit<ComponentProps<typeof RouterLink>, "to"> & {
  href: RouterLinkProps["to"];
};

export default function Link({ href, ...props }: CompatibilityLinkProps) {
  return <RouterLink to={href} {...props} />;
}
