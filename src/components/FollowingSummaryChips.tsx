type FollowingSummaryChipItem = {
  key: string | number;
  label: string;
  active?: boolean;
};

type FollowingSummaryChipsProps = {
  items: FollowingSummaryChipItem[];
};

export function FollowingSummaryChips({ items }: FollowingSummaryChipsProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="home-following-summary">
      {items.map((item) => (
        <span
          key={item.key}
          className={item.active ? 'home-following-summary__chip home-following-summary__chip--active' : 'home-following-summary__chip'}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
