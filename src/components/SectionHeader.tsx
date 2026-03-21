type SectionHeaderProps = {
  title: string;
  description?: string;
  actionLabel?: string;
};

export function SectionHeader({ title, description, actionLabel }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actionLabel ? <span className="section-header__action">{actionLabel}</span> : null}
    </div>
  );
}
