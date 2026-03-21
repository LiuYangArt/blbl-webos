import { FocusButton } from '../../components/FocusButton';
import { FocusSection } from '../../platform/focus';

type PageStatusProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function PageStatus({ title, description, actionLabel, onAction }: PageStatusProps) {
  return (
    <FocusSection
      as="section"
      id="page-status-actions"
      group="content"
      className="page-status"
      leaveFor={{ left: '@side-nav' }}
    >
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <FocusButton
          variant="primary"
          size="hero"
          sectionId="page-status-actions"
          focusId="page-status-primary-action"
          defaultFocus
          onClick={onAction}
        >
          {actionLabel}
        </FocusButton>
      ) : null}
    </FocusSection>
  );
}
