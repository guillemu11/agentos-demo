import { Search } from 'lucide-react';

export default function HubSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
  count,
  total,
}) {
  return (
    <div className="jl__search">
      <Search size={15} strokeWidth={2} className="jl__search-icon" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel || placeholder}
      />
      {value && count != null && total != null && (
        <span className="jl__search-count">{count} / {total}</span>
      )}
    </div>
  );
}
