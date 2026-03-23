import type { ReactNode } from 'react';
import { FocusButton } from '../../components/FocusButton';
import type { PlaySubtitleTrack } from '../../services/api/types';
import type {
  PlayerSubtitleBackgroundOpacity,
  PlayerSubtitleBottomOffset,
  PlayerSubtitleFontSize,
  PlayerSubtitleStyleSettings,
} from './playerSettings';
import { buildGridFocusMap, buildRowTargets, type FocusLinks } from './playerFocusGrid';

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
  const displayIds = ['player-subtitle-enabled-on', 'player-subtitle-enabled-off'] as const;
  const trackIds = tracks.map((track) => `player-subtitle-track-${track.id}`);
  const fontIds = FONT_SIZE_OPTIONS.map((option) => `player-subtitle-font-${option.value}`);
  const bottomIds = BOTTOM_OFFSET_OPTIONS.map((option) => `player-subtitle-bottom-${option.value}`);
  const backgroundIds = BACKGROUND_OPACITY_OPTIONS.map((option) => `player-subtitle-background-${option.value}`);
  const displayTargets = [...displayIds];
  const displayDownTargets = trackIds.length
    ? buildRowTargets(trackIds, 2, 'first', displayIds.length)
    : buildRowTargets(fontIds, 3, 'first', displayIds.length);
  const trackUpTargets = buildRowTargets(displayTargets, 2, 'first', 2);
  const trackDownTargets = buildRowTargets(fontIds, 3, 'first', 2);
  let fontUpTargets: string[] = [];
  if (trackIds.length) {
    fontUpTargets = buildRowTargets(trackIds, 2, 'last', fontIds.length);
  } else {
    fontUpTargets = buildRowTargets(displayTargets, 2, 'first', fontIds.length);
  }
  const bottomUpTargets = buildRowTargets(fontIds, 3, 'first', bottomIds.length);
  const bottomDownTargets = buildRowTargets(backgroundIds, 3, 'first', bottomIds.length);
  const backgroundUpTargets = buildRowTargets(bottomIds, 3, 'first', backgroundIds.length);

  const displayFocusMap = buildGridFocusMap(displayTargets, 2, {
    downByColumn: displayDownTargets,
  });
  const trackFocusMap = buildGridFocusMap(trackIds, 2, {
    upByColumn: trackUpTargets,
    downByColumn: trackDownTargets,
  });
  const fontFocusMap = buildGridFocusMap(fontIds, 3, {
    upByColumn: fontUpTargets,
    downByColumn: buildRowTargets(bottomIds, 3, 'first', fontIds.length),
  });
  const bottomFocusMap = buildGridFocusMap(bottomIds, 3, {
    upByColumn: bottomUpTargets,
    downByColumn: bottomDownTargets,
  });
  const backgroundFocusMap = buildGridFocusMap(backgroundIds, 3, {
    upByColumn: backgroundUpTargets,
  });

  return (
    <FocusButtonSection sectionId={sectionId}>
      <div className="player-subtitle-panel__header">
        <span className="player-settings-drawer__eyebrow">CC 字幕</span>
      </div>

      <div className="player-subtitle-panel__section">
        <span className="player-subtitle-panel__label">显示</span>
        <div className="player-subtitle-panel__chips player-subtitle-panel__chips--display">
          <FocusButton
            variant={subtitleEnabled ? 'primary' : 'ghost'}
            size="sm"
            sectionId={sectionId}
            focusId={displayIds[0]}
            defaultFocus={subtitleEnabled}
            focusRight={displayFocusMap[displayIds[0]]?.right}
            focusDown={displayFocusMap[displayIds[0]]?.down}
            onClick={() => onToggleEnabled(true)}
          >
            开启字幕
          </FocusButton>
          <FocusButton
            variant={!subtitleEnabled ? 'primary' : 'ghost'}
            size="sm"
            sectionId={sectionId}
            focusId={displayIds[1]}
            defaultFocus={!subtitleEnabled}
            focusLeft={displayFocusMap[displayIds[1]]?.left}
            focusDown={displayFocusMap[displayIds[1]]?.down}
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
                focusId={trackIds[index]}
                defaultFocus={index === 0 && activeTrackId === null}
                focusLeft={trackFocusMap[trackIds[index]]?.left}
                focusRight={trackFocusMap[trackIds[index]]?.right}
                focusUp={trackFocusMap[trackIds[index]]?.up}
                focusDown={trackFocusMap[trackIds[index]]?.down}
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
        focusMap={fontFocusMap}
        onChange={onFontSizeChange}
      />

      <SubtitleStyleRow
        sectionId={sectionId}
        title="底部位置"
        focusPrefix="player-subtitle-bottom"
        currentValue={styleSettings.bottomOffset}
        options={BOTTOM_OFFSET_OPTIONS}
        focusMap={bottomFocusMap}
        onChange={onBottomOffsetChange}
      />

      <SubtitleStyleRow
        sectionId={sectionId}
        title="背景透明度"
        focusPrefix="player-subtitle-background"
        currentValue={styleSettings.backgroundOpacity}
        options={BACKGROUND_OPACITY_OPTIONS}
        focusMap={backgroundFocusMap}
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
  focusMap: Record<string, FocusLinks>;
};

function SubtitleStyleRow<TValue extends string>({
  sectionId,
  title,
  focusPrefix,
  currentValue,
  options,
  onChange,
  focusMap,
}: SubtitleStyleRowProps<TValue>) {
  return (
    <div className="player-subtitle-panel__section">
      <span className="player-subtitle-panel__label">{title}</span>
      <div className="player-subtitle-panel__chips">
        {options.map((option, index) => {
          const focusId = `${focusPrefix}-${option.value}`;
          const links = focusMap[focusId];
          return (
            <FocusButton
              key={option.value}
              variant={currentValue === option.value ? 'primary' : 'ghost'}
              size="sm"
              sectionId={sectionId}
              focusId={focusId}
              defaultFocus={index === 0 && currentValue === option.value}
              focusLeft={links?.left}
              focusRight={links?.right}
              focusUp={links?.up}
              focusDown={links?.down}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </FocusButton>
          );
        })}
      </div>
    </div>
  );
}
