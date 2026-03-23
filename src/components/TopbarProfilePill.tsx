type TopbarProfilePillProps = {
  title: string;
  badge: string;
};

export function TopbarProfilePill({ title, badge }: TopbarProfilePillProps) {
  return (
    <div className="tv-topbar__profile">
      <span className="tv-topbar__profile-badge" aria-hidden="true">{badge}</span>
      <span className="tv-topbar__profile-copy">
        <strong>{title}</strong>
      </span>
    </div>
  );
}
