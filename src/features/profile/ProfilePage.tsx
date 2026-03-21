import { useAppStore } from '../../app/AppStore';
import { FocusButton } from '../../components/FocusButton';
import { SectionHeader } from '../../components/SectionHeader';
import { PageStatus } from '../shared/PageStatus';

type ProfilePageProps = {
  isLoggedIn: boolean;
  onLogin: () => void;
  onOpenHistory: () => void;
  onOpenLater: () => void;
  onOpenFavorites: () => void;
};

export function ProfilePage({
  isLoggedIn,
  onLogin,
  onOpenHistory,
  onOpenLater,
  onOpenFavorites,
}: ProfilePageProps) {
  const { auth } = useAppStore();

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

      <section className="content-section">
        <SectionHeader title="你的内容" description="先保留 TV 端最常用的内容入口，避免把“我的”页做成移动端大杂烩。" />
        <div className="chip-grid">
          <FocusButton row={0} col={10} variant="primary" size="hero" defaultFocus onClick={onOpenHistory}>
            观看历史
          </FocusButton>
          <FocusButton row={0} col={11} variant="secondary" size="hero" onClick={onOpenLater}>
            稍后再看
          </FocusButton>
          <FocusButton row={0} col={12} variant="secondary" size="hero" onClick={onOpenFavorites}>
            收藏夹
          </FocusButton>
        </div>
      </section>
    </main>
  );
}
