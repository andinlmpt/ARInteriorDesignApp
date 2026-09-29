interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  className?: string;
}

export function SearchBar({
  placeholder = 'Search…',
  value,
  onChange,
  onSubmit,
  className = '',
}: SearchBarProps) {
  return (
    <div className={`search-bar ${className}`.trim()}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) onSubmit(value);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}
