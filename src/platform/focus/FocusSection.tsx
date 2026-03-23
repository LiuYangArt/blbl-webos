import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';
import type { FocusGroup, FocusSectionConfig, FocusSectionEnterTo, FocusSectionScrollConfig } from './types';
import { registerSection, unregisterSection } from './engine';

type FocusSectionProps<TTag extends ElementType = 'section'> = {
  as?: TTag;
  id: string;
  children: ReactNode;
  selector?: string;
  defaultElement?: string;
  enterTo?: FocusSectionEnterTo;
  leaveFor?: FocusSectionConfig['leaveFor'];
  disabled?: boolean;
  group?: FocusGroup;
  scroll?: FocusSectionScrollConfig;
} & Omit<ComponentPropsWithoutRef<TTag>, 'as' | 'children'>;

export function FocusSection<TTag extends ElementType = 'section'>({
  as,
  id,
  children,
  selector,
  defaultElement,
  enterTo,
  leaveFor,
  disabled = false,
  group = 'content',
  scroll,
  ...props
}: FocusSectionProps<TTag>) {
  const Component = as ?? 'section';
  const config: FocusSectionConfig = {
    id,
    selector,
    defaultElement,
    enterTo,
    leaveFor,
    disabled,
    group,
    scroll,
  };
  const configRef = useRef(config);
  configRef.current = config;

  useLayoutEffect(() => {
    registerSection(configRef.current);

    return () => {
      unregisterSection(id);
    };
    // 仅在 section id 变化或组件卸载时注销，避免普通重渲染打断焦点记忆。
  }, [id]);

  useLayoutEffect(() => {
    registerSection(config);
  });

  return (
    <Component {...props} data-focus-section-root={id}>
      {children}
    </Component>
  );
}
