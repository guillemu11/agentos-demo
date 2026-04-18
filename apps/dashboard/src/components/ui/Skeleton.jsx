export default function Skeleton({ width, height = 16, radius, className = '', style, ...rest }) {
  const css = {
    width: width ?? '100%',
    height,
    borderRadius: radius ?? 'var(--radius-md)',
    ...style,
  };
  return <div className={`ui-skeleton ${className}`.trim()} style={css} aria-hidden="true" {...rest} />;
}
