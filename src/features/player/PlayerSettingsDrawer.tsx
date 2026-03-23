import type { ReactNode } from 'react';
import { FocusButton } from '../../components/FocusButton';

export type PlayerSettingsAction = {
  key: string;
  label: ReactNode;
  variant: 'primary' | 'secondary' | 'glass' | 'ghost';
  className?: string;
  disabled?: boolean;
  defaultFocus?: boolean;
  onClick?: () => void;
};

export type PlayerSettingsInfoRow = {
  key: string;
  label: ReactNode;
  value: ReactNode;
};

type PlayerSettingsDrawerProps = {
  sectionId: string;
  badge: string;
  title: string;
  description: ReactNode;
  qualityOptions?: PlayerSettingsAction[];
  qualityHint?: ReactNode;
  codecOptions?: PlayerSettingsAction[];
  infoRows?: PlayerSettingsInfoRow[];
  infoHint?: ReactNode;
  actionOptions?: PlayerSettingsAction[];
  planText?: ReactNode;
};

function renderActionButton(sectionId: string, action: PlayerSettingsAction) {
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
      onClick={action.onClick}
    >
      {action.label}
    </FocusButton>
  );
}

export function PlayerSettingsDrawer({
  sectionId,
  badge,
  title,
  description,
  qualityOptions = [],
  qualityHint,
  codecOptions = [],
  infoRows = [],
  infoHint,
  actionOptions = [],
  planText,
}: PlayerSettingsDrawerProps) {
  return (
    <>
      <div className="player-settings-drawer__header">
        <span className="player-hero__badge">{badge}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {qualityOptions.length ? (
        <div className="player-settings-drawer__section">
          <span className="player-settings-drawer__label">画质</span>
          <div className="player-settings-drawer__chips">
            {qualityOptions.map((action) => renderActionButton(sectionId, action))}
          </div>
          {qualityHint ? <p className="player-settings-drawer__hint">{qualityHint}</p> : null}
        </div>
      ) : null}

      {codecOptions.length ? (
        <div className="player-settings-drawer__section">
          <span className="player-settings-drawer__label">编码偏好</span>
          <div className="player-settings-drawer__chips">
            {codecOptions.map((action) => renderActionButton(sectionId, action))}
          </div>
        </div>
      ) : null}

      {infoRows.length ? (
        <div className="player-settings-drawer__section">
          <span className="player-settings-drawer__label">当前线路信息</span>
          <div className="player-settings-drawer__info">
            {infoRows.map((row) => (
              <div key={row.key} className="player-settings-drawer__info-row">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          {infoHint ? <p className="player-settings-drawer__hint">{infoHint}</p> : null}
        </div>
      ) : null}

      {actionOptions.length ? (
        <div className="player-settings-drawer__section">
          <span className="player-settings-drawer__label">快捷操作</span>
          <div className="player-settings-drawer__actions">
            {actionOptions.map((action) => renderActionButton(sectionId, action))}
          </div>
        </div>
      ) : null}

      {planText ? (
        <div className="player-settings-drawer__section">
          <span className="player-settings-drawer__label">当前候选顺序</span>
          <p className="player-settings-drawer__hint">{planText}</p>
        </div>
      ) : null}
    </>
  );
}
