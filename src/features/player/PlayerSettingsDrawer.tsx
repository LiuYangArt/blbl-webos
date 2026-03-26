import type { ReactNode } from 'react';
import { FocusButton } from '../../components/FocusButton';
import { buildStackedGridFocusMap, type FocusGridSection, type FocusLinks } from './playerFocusGrid';

export type PlayerSettingsAction = {
  key: string;
  label: ReactNode;
  variant: 'primary' | 'secondary' | 'glass' | 'ghost';
  className?: string;
  disabled?: boolean;
  defaultFocus?: boolean;
  onClick?: () => void;
};

type PlayerSettingsDrawerProps = {
  sectionId: string;
  badge: string;
  qualityOptions?: PlayerSettingsAction[];
  codecOptions?: PlayerSettingsAction[];
  summaryText?: ReactNode;
  debugText?: ReactNode;
  actionOptions?: PlayerSettingsAction[];
};

function renderActionButton(sectionId: string, action: PlayerSettingsAction, links?: FocusLinks) {
  return (
    <FocusButton
      key={action.key}
      variant={action.variant}
      size="sm"
      sectionId={sectionId}
      focusId={action.key}
      className={action.className}
      disabled={action.disabled}
      defaultFocus={action.defaultFocus}
      focusLeft={links?.left}
      focusRight={links?.right}
      focusUp={links?.up}
      focusDown={links?.down}
      onClick={action.onClick}
    >
      {action.label}
    </FocusButton>
  );
}

export function PlayerSettingsDrawer({
  sectionId,
  badge,
  qualityOptions = [],
  codecOptions = [],
  summaryText,
  debugText,
  actionOptions = [],
}: PlayerSettingsDrawerProps) {
  const qualityIds = qualityOptions.map((action) => action.key);
  const codecIds = codecOptions.map((action) => action.key);
  const actionIds = actionOptions.map((action) => action.key);
  const focusSections: FocusGridSection[] = [
    { ids: qualityIds, columns: Math.min(2, Math.max(1, qualityIds.length)) },
    { ids: codecIds, columns: Math.min(4, Math.max(1, codecIds.length)) },
    { ids: actionIds, columns: Math.min(2, Math.max(1, actionIds.length)) },
  ];
  const focusMap = buildStackedGridFocusMap(focusSections);

  return (
    <>
      <div className="player-settings-drawer__header">
        <span className="player-settings-drawer__eyebrow">{badge}</span>
      </div>

      {qualityOptions.length ? (
        <div className="player-settings-drawer__section">
          <span className="player-settings-drawer__label">画质</span>
          <div className="player-settings-drawer__chips">
            {qualityOptions.map((action) => renderActionButton(sectionId, action, focusMap[action.key]))}
          </div>
        </div>
      ) : null}

      {codecOptions.length ? (
        <div className="player-settings-drawer__section">
          <span className="player-settings-drawer__label">编码偏好</span>
          <div className="player-settings-drawer__chips">
            {codecOptions.map((action) => renderActionButton(sectionId, action, focusMap[action.key]))}
          </div>
        </div>
      ) : null}

      {summaryText ? (
        <div className="player-settings-drawer__section">
          <span className="player-settings-drawer__label">当前播放</span>
          <p className="player-settings-drawer__summary">{summaryText}</p>
          {debugText ? <p className="player-settings-drawer__meta">{debugText}</p> : null}
        </div>
      ) : null}

      {actionOptions.length ? (
        <div className="player-settings-drawer__section">
          <span className="player-settings-drawer__label">快捷操作</span>
          <div className="player-settings-drawer__actions">
            {actionOptions.map((action) => renderActionButton(sectionId, action, focusMap[action.key]))}
          </div>
        </div>
      ) : null}
    </>
  );
}
