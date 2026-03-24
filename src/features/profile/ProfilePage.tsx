import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/AppStore';
import { FollowingSummaryChips } from '../../components/FollowingSummaryChips';
import { FocusButton } from '../../components/FocusButton';
import { SearchComposer } from '../../components/SearchComposer';
import { SectionHeader } from '../../components/SectionHeader';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../../platform/focus';
import type { FocusSectionScrollConfig } from '../../platform/focus';
import { PageStatus } from '../shared/PageStatus';
import {
  ensureRelaySession,
  fetchRelayAuthStatus,
  pingRelay,
  type RelayAuthStatus,
} from '../../services/relay/client';
import { hasRelayConfiguration, readRelayAuthMaterial, readRelaySettings, writeRelaySettings } from '../../services/relay/settings';

type ProfilePageProps = {
  isLoggedIn: boolean;
  onLogin: () => void;
  onOpenHistory: () => void;
  onOpenLater: () => void;
  onOpenFavorites: () => void;
};

const RELAY_SETTINGS_SCROLL: FocusSectionScrollConfig = {
  mode: 'comfort-zone',
  anchor: 'focused-element',
  preserveHeaderWhenFirstRowFocused: false,
};

export function ProfilePage({
  isLoggedIn,
  onLogin,
  onOpenHistory,
  onOpenLater,
  onOpenFavorites,
}: ProfilePageProps) {
  const { auth } = useAppStore();
  const [relayDraft, setRelayDraft] = useState(() => readRelaySettings());
  const [relayHostInput, setRelayHostInput] = useState(() => readRelaySettings().host);
  const [relayPortInput, setRelayPortInput] = useState(() => String(readRelaySettings().port));
  const [relayStatus, setRelayStatus] = useState<RelayAuthStatus | null>(null);
  const [relayHealth, setRelayHealth] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [relayMessage, setRelayMessage] = useState('还没有检查代理服务器状态。');
  const [relayBusy, setRelayBusy] = useState(false);
  const lastAutoSyncKeyRef = useRef('');

  const authMaterial = readRelayAuthMaterial();
  const currentProfile = auth.profile;
  const hasRelayAuthMaterialForCurrentProfile = Boolean(
    currentProfile
    && authMaterial
    && authMaterial.mid === currentProfile.mid,
  );

  const loadRelayStatus = useCallback(async (settings: typeof relayDraft) => {
    if (!settings.enabled) {
      setRelayHealth('unknown');
      setRelayStatus(null);
      setRelayMessage('当前已关闭 relay 优先模式。');
      return;
    }

    if (!hasRelayConfiguration(settings)) {
      setRelayHealth('unknown');
      setRelayStatus(null);
      setRelayMessage('请先填写代理服务器地址。');
      return;
    }

    try {
      await pingRelay(settings);
      setRelayHealth('online');
      let status = await fetchRelayAuthStatus(settings);
      let nextMessage: string | null = null;

      if (
        currentProfile
        && authMaterial
        && authMaterial.mid === currentProfile.mid
        && (!status.loggedIn || status.cookieExpired || status.mid !== currentProfile.mid)
      ) {
        const autoSync = await ensureRelaySession(settings, currentProfile, authMaterial, 'profile-open');
        if (autoSync.usable) {
          status = await fetchRelayAuthStatus(settings);
          nextMessage = '已根据本地保存的扫码材料自动同步 relay 账号。';
        } else if (autoSync.message) {
          nextMessage = autoSync.message;
        }
      }

      setRelayStatus(status);
      if (status.loggedIn && !status.cookieExpired && status.mid === currentProfile?.mid) {
        nextMessage = `relay 当前已同步账号：${status.uname ?? '未知用户'}（MID ${status.mid ?? 0}）。`;
      } else if (status.cookieExpired) {
        nextMessage ??= 'relay 当前账号已过期，播放时会先尝试自动重同步。';
      } else if (currentProfile && !hasRelayAuthMaterialForCurrentProfile) {
        nextMessage ??= '当前 TV 账号已登录，但 relay 还缺一次扫码确认。按“去扫码同步 relay”即可补齐。';
      } else {
        nextMessage ??= 'relay 在线，但还没有同步当前账号。';
      }
      setRelayMessage(nextMessage);
    } catch (error) {
      setRelayHealth('offline');
      setRelayStatus(null);
      setRelayMessage(error instanceof Error ? `代理服务器不可用：${error.message}` : '代理服务器不可用。');
    }
  }, [authMaterial, currentProfile, hasRelayAuthMaterialForCurrentProfile]);

  useEffect(() => {
    void loadRelayStatus(readRelaySettings());
  }, [loadRelayStatus]);

  const handleRelayHostChange = useCallback((value: string) => {
    setRelayHostInput(value);
    setRelayHealth('unknown');
    setRelayStatus(null);
    setRelayMessage(value.trim()
      ? '代理服务器地址已自动保存，可直接测试连接。'
      : '请先填写代理服务器 IP。');
  }, []);

  const handleRelayPortChange = useCallback((value: string) => {
    setRelayPortInput(value);
    setRelayHealth('unknown');
    setRelayStatus(null);
    setRelayMessage(relayHostInput.trim()
      ? '代理服务器地址已自动保存，可直接测试连接。'
      : '请先填写代理服务器 IP。');
  }, [relayHostInput]);

  useEffect(() => {
    const saved = writeRelaySettings({
      host: relayHostInput,
      port: Number(relayPortInput || 19091),
    });
    setRelayDraft((current) => (
      current.host === saved.host
      && current.port === saved.port
      && current.enabled === saved.enabled
      && current.accessToken === saved.accessToken
      && current.healthTimeoutMs === saved.healthTimeoutMs
      && current.requestTimeoutMs === saved.requestTimeoutMs
        ? current
        : saved
    ));
  }, [relayHostInput, relayPortInput]);

  const getCurrentRelaySettings = useCallback(() => writeRelaySettings({
    host: relayHostInput,
    port: Number(relayPortInput || 19091),
  }), [relayHostInput, relayPortInput]);

  useEffect(() => {
    if (
      !currentProfile
      || !relayDraft.enabled
      || !hasRelayConfiguration(relayDraft)
      || !authMaterial
      || authMaterial.mid !== currentProfile.mid
    ) {
      lastAutoSyncKeyRef.current = '';
      return;
    }

    const autoSyncKey = [
      currentProfile.mid,
      relayDraft.host,
      relayDraft.port,
      authMaterial.capturedAt,
    ].join(':');

    if (lastAutoSyncKeyRef.current === autoSyncKey) {
      return;
    }

    lastAutoSyncKeyRef.current = autoSyncKey;

    void (async () => {
      try {
        const result = await ensureRelaySession(relayDraft, currentProfile, authMaterial, 'profile-settings');
        if (result.usable) {
          setRelayMessage('已根据本地保存的扫码材料自动同步 relay 账号。');
          await loadRelayStatus(relayDraft);
        }
      } catch {
        // 页面仍可继续使用，失败时交给状态区文案提示。
      }
    })();
  }, [authMaterial, currentProfile, loadRelayStatus, relayDraft]);

  if (!isLoggedIn || !auth.profile) {
    return (
      <PageStatus
        title="还没有登录"
        description="扫码成功后，这里会展示你的头像、昵称和常用内容入口。"
        actionLabel="去扫码登录"
        onAction={onLogin}
      />
    );
  }

  const profile = auth.profile;
  const relaySummaryItems = [
    {
      key: 'relay-health',
      label: `服务器 ${relayHealth === 'online' ? '在线' : relayHealth === 'offline' ? '离线' : '待检测'}`,
      active: relayHealth === 'online',
    },
    {
      key: 'relay-account',
      label: relayStatus?.loggedIn && !relayStatus.cookieExpired
        ? `relay ${relayStatus.uname ?? '已同步'}`
        : 'relay 未同步',
      active: Boolean(relayStatus?.loggedIn && !relayStatus.cookieExpired),
    },
    {
      key: 'relay-material',
      label: hasRelayAuthMaterialForCurrentProfile ? '可自动补同步' : '需扫码补同步',
      active: hasRelayAuthMaterialForCurrentProfile,
    },
  ];

  return (
    <main className="page-shell">
      <section className="content-section profile-hero">
        <div className="profile-hero__avatar">
          <img src={auth.profile.face} alt="" referrerPolicy="no-referrer" />
        </div>
        <div className="profile-hero__content">
          <span className="detail-hero__tag">个人中心</span>
          <h1>{auth.profile.name}</h1>
          <p>{auth.profile.sign || '这个账号还没有公开个性签名。'}</p>
          <div className="profile-hero__meta">
            <span>Lv.{auth.profile.level}</span>
            <span>{auth.profile.vipLabel ?? '普通用户'}</span>
            <span>{auth.profile.coin} 硬币</span>
            <span>{auth.profile.following} 关注</span>
            <span>{auth.profile.follower} 粉丝</span>
          </div>
        </div>
      </section>

      <FocusSection
        as="section"
        id="profile-actions"
        group="content"
        className="content-section"
        enterTo="last-focused"
        leaveFor={{ left: '@side-nav', down: '@relay-settings' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <SectionHeader title="你的内容" />
        <div className="chip-grid">
          <FocusButton
            variant="primary"
            size="hero"
            sectionId="profile-actions"
            focusId="profile-history"
            defaultFocus
            onClick={onOpenHistory}
          >
            观看历史
          </FocusButton>
          <FocusButton
            variant="secondary"
            size="hero"
            sectionId="profile-actions"
            focusId="profile-later"
            onClick={onOpenLater}
          >
            稍后再看
          </FocusButton>
          <FocusButton
            variant="secondary"
            size="hero"
            sectionId="profile-actions"
            focusId="profile-favorites"
            onClick={onOpenFavorites}
          >
            收藏夹
          </FocusButton>
        </div>
      </FocusSection>

      <FocusSection
        as="section"
        id="relay-settings"
        group="content"
        className="content-section relay-settings-panel"
        defaultElement="relay-host-input"
        leaveFor={{ left: '@side-nav' }}
        scroll={RELAY_SETTINGS_SCROLL}
      >
        <SectionHeader
          title="Playurl Relay"
          description="这里默认总是 relay 优先，失败时自动回退直连。局域网默认不要求输入访问令牌。"
        />

        <div className="relay-settings-panel__body">
          <SearchComposer
            fields={[
              {
                key: 'relay-host',
                label: '服务器 IP',
                value: relayHostInput,
                placeholder: '例如 192.168.50.10',
                defaultFocus: true,
                autoFocus: false,
                focusId: 'relay-host-input',
                sectionId: 'relay-settings',
                focusUp: '@profile-actions',
                focusRight: 'relay-port-input',
                focusDown: 'relay-test-connection',
                maxLength: 15,
                valueFilter: 'ip-address',
                onChange: handleRelayHostChange,
              },
              {
                key: 'relay-port',
                label: '端口',
                value: relayPortInput,
                placeholder: '19091',
                focusId: 'relay-port-input',
                sectionId: 'relay-settings',
                focusUp: '@profile-actions',
                focusLeft: 'relay-host-input',
                focusDown: 'relay-sync-current-account',
                maxLength: 5,
                valueFilter: 'digits',
                onChange: handleRelayPortChange,
              },
            ]}
          />
          <p className="page-helper-text relay-settings-panel__hint">
            只需要输入局域网里的服务器 IP。端口默认 19091，修改后会自动保存，不需要手动点保存。
          </p>

          <div className="relay-settings-panel__block">
            <span className="player-settings-drawer__label">检查与同步</span>
            <div className="player-settings-drawer__actions relay-settings-panel__actions">
              <FocusButton
                variant="primary"
                size="md"
                sectionId="relay-settings"
                focusId="relay-test-connection"
                focusUp="relay-host-input"
                disabled={relayBusy}
                onClick={async () => {
                  setRelayBusy(true);
                  const settings = getCurrentRelaySettings();
                  setRelayDraft(settings);
                  await loadRelayStatus(settings);
                  setRelayBusy(false);
                }}
              >
                测试连接
              </FocusButton>
              <FocusButton
                variant="secondary"
                size="md"
                sectionId="relay-settings"
                focusId="relay-sync-current-account"
                focusUp="relay-port-input"
                disabled={relayBusy}
                onClick={async () => {
                  if (!authMaterial || authMaterial.mid !== profile.mid) {
                    onLogin();
                    return;
                  }

                  setRelayBusy(true);
                  const settings = getCurrentRelaySettings();
                  setRelayDraft(settings);
                  const result = await ensureRelaySession(settings, profile, authMaterial, 'manual-sync');
                  setRelayMessage(result.usable
                    ? 'relay 已同步当前账号，后续播放会优先走代理。'
                    : result.message ?? 'relay 同步失败，本次仍会回退直连。');
                  await loadRelayStatus(settings);
                  setRelayBusy(false);
                }}
              >
                {hasRelayAuthMaterialForCurrentProfile ? '重新同步当前账号' : '去扫码同步 relay'}
              </FocusButton>
            </div>
            <p className="player-settings-drawer__hint relay-settings-panel__action-hint">{relayMessage}</p>
            <div className="relay-settings-panel__summary">
              <FollowingSummaryChips items={relaySummaryItems} />
            </div>
          </div>
        </div>
      </FocusSection>
    </main>
  );
}
