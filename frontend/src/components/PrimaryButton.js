import React from 'react';
import './PrimaryButton.css';

/**
 * Reusable primary button – gradient (blue), rounded-full, scale on hover.
 * Use variant="cta" for amber CTA style.
 */
const PrimaryButton = ({
  children,
  type = 'button',
  variant = 'primary',
  disabled = false,
  className = '',
  fullWidth = false,
  onClick,
  ...props
}) => {
  return (
    <button
      type={type}
      className={`primary-btn primary-btn--${variant} ${fullWidth ? 'primary-btn--full' : ''} ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

export default PrimaryButton;
