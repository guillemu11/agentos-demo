import { forwardRef } from 'react';

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', type = 'button', className = '', children, ...rest },
  ref,
) {
  const cls = `ui-btn ui-btn--${variant} ui-btn--${size} ${className}`.trim();
  return (
    <button ref={ref} type={type} className={cls} {...rest}>
      {children}
    </button>
  );
});

export default Button;
