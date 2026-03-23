import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { useLayoutEffect } from 'react';
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

  useLayoutEffect(() => {
    registerSection({
      id,
      selector,
      defaultElement,
      enterTo,
      leaveFor,
      disabled,
      group,
      scroll,
    });

    return () => {
      unregisterSection(id);
    };
  }, [defaultElement, disabled, enterTo, group, id, leaveFor, scroll, selector]);

  return (
    <Component {...props} data-focus-section-root={id}>
      {children}
    </Component>
  );
}
