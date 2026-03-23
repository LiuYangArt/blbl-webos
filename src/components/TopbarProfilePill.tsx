type TopbarProfilePillProps = {
  label: string;
};

export function TopbarProfilePill({ label }: TopbarProfilePillProps) {
  return <span className="tv-topbar__profile">{label}</span>;
}
