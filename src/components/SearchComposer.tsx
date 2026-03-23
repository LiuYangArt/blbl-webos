type SearchComposerProps = {
  value: string;
  label?: string;
  placeholder?: string;
  submitLabel: string;
  closeLabel?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose?: () => void;
};

export function SearchComposer({
  value,
  label = '关键词',
  placeholder,
  submitLabel,
  closeLabel = '关闭输入面板',
  autoFocus = true,
  readOnly = false,
  onChange,
  onSubmit,
  onClose,
}: SearchComposerProps) {
  return (
    <div className="search-composer">
      <label className="search-composer__field">
        <span>{label}</span>
        <input
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSubmit();
            }
          }}
        />
      </label>
      <div className="search-composer__actions">
        <button type="button" onClick={onSubmit}>
          {submitLabel}
        </button>
        {onClose ? (
          <button type="button" onClick={onClose}>
            {closeLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
