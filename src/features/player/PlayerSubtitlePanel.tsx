import type { ReactNode } from 'react';
import { FocusButton } from '../../components/FocusButton';
import type { PlaySubtitleTrack } from '../../services/api/types';
import type {
  PlayerSubtitleBackgroundOpacity,
  PlayerSubtitleBottomOffset,
  PlayerSubtitleFontSize,
  PlayerSubtitleStyleSettings,
} from './playerSettings';

type PlayerSubtitlePanelProps = {
  sectionId: string;
  subtitleEnabled: boolean;
  activeTrackId: number | null;
  tracks: PlaySubtitleTrack[];
  styleSettings: PlayerSubtitleStyleSettings;
  loadingState: 'idle' | 'loading' | 'ready' | 'error';
  statusText: string | null;
  onToggleEnabled: (enabled: boolean) => void;
  onSelectTrack: (trackId: number) => void;
  onFontSizeChange: (value: PlayerSubtitleFontSize) => void;
  onBottomOffsetChange: (value: PlayerSubtitleBottomOffset) => void;
  onBackgroundOpacityChange: (value: PlayerSubtitleBackgroundOpacity) => void;
};

const FONT_SIZE_OPTIONS: Array<{ value: PlayerSubtitleFontSize; label: string }> = [
  { value: 'standard', label: '标准' },
  { value: 'large', label: '偏大' },
  { value: 'extra-large', label: '超大' },
];

const BOTTOM_OFFSET_OPTIONS: Array<{ value: PlayerSubtitleBottomOffset; label: string }> = [
  { value: 'low', label: '贴近底部' },
  { value: 'medium', label: '默认高度' },
  { value: 'high', label: '再抬高一些' },
];

const BACKGROUND_OPACITY_OPTIONS: Array<{ value: PlayerSubtitleBackgroundOpacity; label: string }> = [
  { value: 'light', label: '浅背景' },
  { value: 'medium', label: '中背景' },
  { value: 'strong', label: '深背景' },
];

export function PlayerSubtitlePanel({
  sectionId,
  subtitleEnabled,
  activeTrackId,
  tracks,
  styleSettings,
  loadingState,
  statusText,
  onToggleEnabled,
  onSelectTrack,
  onFontSizeChange,
  onBottomOffsetChange,
  onBackgroundOpacityChange,
}: PlayerSubtitlePanelProps) {
  return (
    <FocusButtonSection sectionId={sectionId}>
      <div className="player-subtitle-panel__header">
        <span className="player-hero__badge">CC 字幕</span>
        <h2>字幕与样式</h2>
        <p>默认会优先选择可用字幕。关闭后会记住你的偏好。</p>
      </div>

      <div className="player-subtitle-panel__section">
        <span className="player-subtitle-panel__label">显示</span>
        <div className="player-subtitle-panel__chips">
          <FocusButton
            variant={subtitleEnabled ? 'primary' : 'ghost'}
            size="sm"
            sectionId={sectionId}
            focusId="player-subtitle-enabled-on"
            defaultFocus={subtitleEnabled}
            onClick={() => onToggleEnabled(true)}
          >
            开启字幕
          </FocusButton>
          <FocusButton
            variant={!subtitleEnabled ? 'primary' : 'ghost'}
            size="sm"
            sectionId={sectionId}
            focusId="player-subtitle-enabled-off"
            defaultFocus={!subtitleEnabled}
            onClick={() => onToggleEnabled(false)}
          >
            关闭字幕
          </FocusButton>
        </div>
      </div>

      <div className="player-subtitle-panel__section">
        <span className="player-subtitle-panel__label">语言 / 轨道</span>
        <div className="player-subtitle-panel__chips">
          {tracks.map((track, index) => {
            const isSelected = subtitleEnabled && activeTrackId === track.id;
            return (
              <FocusButton
                key={track.id}
                variant={isSelected ? 'primary' : 'ghost'}
                size="sm"
                sectionId={sectionId}
                focusId={`player-subtitle-track-${track.id}`}
                defaultFocus={index === 0 && activeTrackId === null}
                onClick={() => onSelectTrack(track.id)}
              >
                {track.langDoc || track.lang || `轨道 ${index + 1}`}
              </FocusButton>
            );
          })}
        </div>
        {statusText ? <p className="player-subtitle-panel__hint">{statusText}</p> : null}
        {loadingState === 'loading' ? (
          <p className="player-subtitle-panel__hint">正在准备字幕文本轨，请稍候。</p>
        ) : null}
      </div>

      <SubtitleStyleRow
        sectionId={sectionId}
        title="字号"
        focusPrefix="player-subtitle-font"
        currentValue={styleSettings.fontSize}
        options={FONT_SIZE_OPTIONS}
        onChange={onFontSizeChange}
      />

      <SubtitleStyleRow
        sectionId={sectionId}
        title="底部位置"
        focusPrefix="player-subtitle-bottom"
        currentValue={styleSettings.bottomOffset}
        options={BOTTOM_OFFSET_OPTIONS}
        onChange={onBottomOffsetChange}
      />

      <SubtitleStyleRow
        sectionId={sectionId}
        title="背景透明度"
        focusPrefix="player-subtitle-background"
        currentValue={styleSettings.backgroundOpacity}
        options={BACKGROUND_OPACITY_OPTIONS}
        onChange={onBackgroundOpacityChange}
      />
    </FocusButtonSection>
  );
}

type FocusButtonSectionProps = {
  sectionId: string;
  children: ReactNode;
};

function FocusButtonSection({ sectionId, children }: FocusButtonSectionProps) {
  return (
    <div className="player-subtitle-panel" data-player-subtitle-section={sectionId}>
      {children}
    </div>
  );
}

type SubtitleStyleRowProps<TValue extends string> = {
  sectionId: string;
  title: string;
  focusPrefix: string;
  currentValue: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
};

function SubtitleStyleRow<TValue extends string>({
  sectionId,
  title,
  focusPrefix,
  currentValue,
  options,
  onChange,
}: SubtitleStyleRowProps<TValue>) {
  return (
    <div className="player-subtitle-panel__section">
      <span className="player-subtitle-panel__label">{title}</span>
      <div className="player-subtitle-panel__chips">
        {options.map((option, index) => (
          <FocusButton
            key={option.value}
            variant={currentValue === option.value ? 'primary' : 'ghost'}
            size="sm"
            sectionId={sectionId}
            focusId={`${focusPrefix}-${option.value}`}
            defaultFocus={index === 0 && currentValue === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </FocusButton>
        ))}
      </div>
    </div>
  );
}
