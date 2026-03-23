import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { FocusButton } from '../../components/FocusButton';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../../platform/focus';
import { createWebQrLogin, pollWebQrLogin } from '../../services/api/bilibili';
import { useAppStore } from '../../app/AppStore';
import { PageStatus } from '../shared/PageStatus';

type LoginPageProps = {
  onCompleted: () => void;
};

type LoginFlowState =
  | { status: 'loading'; message: string }
  | { status: 'ready'; qrUrl: string; loginUrl: string; key: string; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

export function LoginPage({ onCompleted }: LoginPageProps) {
  const { refreshAuth } = useAppStore();
  const [state, setState] = useState<LoginFlowState>({ status: 'loading', message: '正在生成二维码' });

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    const run = async () => {
      setState({ status: 'loading', message: '正在生成二维码' });
      try {
        const qrData = await createWebQrLogin();
        const qrUrl = await QRCode.toDataURL(qrData.url, { margin: 1, width: 300 });
        if (!active) {
          return;
        }
        setState({
          status: 'ready',
          qrUrl,
          loginUrl: qrData.url,
          key: qrData.key,
          message: '请使用哔哩哔哩 App 扫码，并在手机上确认登录。',
        });

        timer = window.setInterval(async () => {
          try {
            const result = await pollWebQrLogin(qrData.key);
            if (!active) {
              return;
            }
            switch (result.code) {
              case 0:
                setState({ status: 'success', message: '登录成功，正在同步当前账号信息。' });
                window.clearInterval(timer ?? undefined);
                await refreshAuth();
                onCompleted();
                break;
              case 86090:
                setState((current) => current.status === 'ready'
                  ? { ...current, message: '二维码已生成，等待扫码。' }
                  : current);
                break;
              case 86101:
                setState((current) => current.status === 'ready'
                  ? { ...current, message: '已扫码，请在手机上确认登录。' }
                  : current);
                break;
              case 86038:
                window.clearInterval(timer ?? undefined);
                setState({ status: 'error', message: '二维码已过期，请重新生成。' });
                break;
              default:
                setState((current) => current.status === 'ready'
                  ? { ...current, message: result.message || '等待登录结果中…' }
                  : current);
                break;
            }
          } catch (error) {
            if (!active) {
              return;
            }
            setState({ status: 'error', message: error instanceof Error ? error.message : '扫码状态轮询失败' });
            window.clearInterval(timer ?? undefined);
          }
        }, 2000);
      } catch (error) {
        if (!active) {
          return;
        }
        setState({ status: 'error', message: error instanceof Error ? error.message : '二维码生成失败' });
      }
    };

    void run();

    return () => {
      active = false;
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [onCompleted, refreshAuth]);

  if (state.status === 'loading') {
    return <PageStatus title="准备扫码登录" description={state.message} />;
  }

  if (state.status === 'error') {
    return (
      <PageStatus
        title="登录二维码不可用"
        description={state.message}
        actionLabel="重新生成二维码"
        onAction={() => window.location.reload()}
      />
    );
  }

  if (state.status === 'success') {
    return <PageStatus title="登录成功" description={state.message} />;
  }

  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id="login-actions"
        group="content"
        className="content-section login-panel"
        leaveFor={{ left: '@side-nav' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <div className="login-panel__content">
          <div className="login-panel__qr">
            <img src={state.qrUrl} alt="哔哩哔哩扫码登录二维码" />
          </div>
          <div className="login-panel__meta">
            <span className="detail-hero__tag">扫码登录</span>
            <h1>用手机确认后，同步你的历史与收藏</h1>
            <p>{state.message}</p>
            <ol className="login-panel__steps">
              <li>打开哔哩哔哩 App，使用扫一扫。</li>
              <li>扫描电视上的二维码，并在手机上确认。</li>
              <li>确认后会自动回到个人中心，无需手动刷新。</li>
            </ol>
            <div className="login-panel__actions">
              <FocusButton
                variant="primary"
                size="hero"
                sectionId="login-actions"
                focusId="login-open-web"
                defaultFocus
                onClick={() => window.open(state.loginUrl, '_blank', 'noopener,noreferrer')}
              >
                在新窗口打开登录页
              </FocusButton>
            </div>
          </div>
        </div>
      </FocusSection>
    </main>
  );
}
