export type Direction = 'left' | 'right' | 'up' | 'down';

export type FocusGroup = 'content' | 'nav' | 'overlay' | string;

export type FocusSectionEnterTo = 'default-element' | 'last-focused';

export type FocusTarget = string | HTMLElement | null | undefined;

export type FocusScrollMode = 'none' | 'comfort-zone';

export type FocusScrollAnchor = 'section-start' | 'section-header' | 'focused-element';

export type FocusSectionScrollConfig = {
  mode?: FocusScrollMode;
  anchor?: FocusScrollAnchor;
  preserveHeaderWhenFirstRowFocused?: boolean;
  topOffset?: number;
};

export type FocusSectionConfig = {
  id: string;
  selector?: string;
  defaultElement?: string;
  enterTo?: FocusSectionEnterTo;
  leaveFor?: Partial<Record<Direction, string>>;
  disabled?: boolean;
  group?: FocusGroup;
  scroll?: FocusSectionScrollConfig;
};

export type FocusFirstOptions = {
  preferredGroup?: FocusGroup;
  allowFallbackGroup?: boolean;
  sectionId?: string;
};

export type FocusCaptureOptions = {
  sectionId: string;
  restoreTarget?: FocusTarget;
};
