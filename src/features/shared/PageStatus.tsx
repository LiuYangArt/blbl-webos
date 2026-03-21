import { FocusButton } from '../../components/FocusButton';

type PageStatusProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function PageStatus({ title, description, actionLabel, onAction }: PageStatusProps) {
  return (
    <section className="page-status">
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <FocusButton row={0} col={10} variant="primary" size="hero" defaultFocus onClick={onAction}>
          {actionLabel}
        </FocusButton>
      ) : null}
    </section>
  );
}
