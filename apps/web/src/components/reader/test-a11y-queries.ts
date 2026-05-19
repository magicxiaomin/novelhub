import * as React from 'react';
import type { ReactElement, ReactNode } from 'react';

export type RoleElement = ReactElement<{
  [key: string]: unknown;
  children?: ReactNode;
  href?: string;
  onClick?: () => void;
}>;

const textFrom = (node: ReactNode): string => {
  if (node == null || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textFrom).join('');
  }
  if (React.isValidElement<{ children?: ReactNode }>(node)) {
    return textFrom(node.props.children);
  }
  return '';
};

const roleFor = (element: RoleElement): string | null => {
  const explicitRole = element.props.role;
  if (typeof explicitRole === 'string') {
    return explicitRole;
  }
  if (element.type === 'button') {
    return 'button';
  }
  if (element.type === 'a') {
    return 'link';
  }
  if (element.type === 'nav') {
    return 'navigation';
  }
  if (/^h[1-6]$/.test(String(element.type))) {
    return 'heading';
  }
  return null;
};

const accessibleNameFor = (element: RoleElement): string => {
  const ariaLabel = element.props['aria-label'];
  return typeof ariaLabel === 'string' ? ariaLabel : textFrom(element.props.children).trim();
};

const walk = (node: ReactNode, matches: RoleElement[] = []): RoleElement[] => {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, matches));
    return matches;
  }
  if (!React.isValidElement(node)) {
    return matches;
  }
  const element = node as RoleElement;
  if (typeof element.type === 'function') {
    const Component = element.type as (props: RoleElement['props']) => ReactNode;
    walk(Component(element.props), matches);
    return matches;
  }
  matches.push(element);
  walk(element.props.children, matches);
  return matches;
};

export const getByRole = (
  root: ReactNode,
  role: string,
  options?: { name?: string | RegExp },
): RoleElement => {
  const matches = walk(root).filter((element) => {
    if (roleFor(element) !== role) {
      return false;
    }
    if (!options?.name) {
      return true;
    }
    const name = accessibleNameFor(element);
    return typeof options.name === 'string' ? name === options.name : options.name.test(name);
  });
  if (matches.length !== 1) {
    throw new Error(`Expected one ${role} match, found ${matches.length}`);
  }
  return matches[0]!;
};

export const getByLabelText = (root: ReactNode, label: string | RegExp): RoleElement => {
  const matches = walk(root).filter((element) => {
    const ariaLabel = element.props['aria-label'];
    if (typeof ariaLabel !== 'string') {
      return false;
    }
    return typeof label === 'string' ? ariaLabel === label : label.test(ariaLabel);
  });
  if (matches.length !== 1) {
    throw new Error(`Expected one label match, found ${matches.length}`);
  }
  return matches[0]!;
};
