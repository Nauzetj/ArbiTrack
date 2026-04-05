import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  let btnClasses = `btn btn-${variant} ${fullWidth ? 'w-full' : ''} ${className}`;

  return (
    <button className={btnClasses} {...props}>
      {children}
    </button>
  );
};
