import React from 'react';
import './Button.css';

const Button = ({ children, variant = 'primary', icon: Icon, onClick, type = 'button', className = '', ...props }) => {
  const baseClass = 'btn';
  const variantClass = variant === 'primary' ? 'btn-primary' : variant === 'secondary' ? 'btn-secondary' : variant === 'icon' ? 'btn-icon' : '';
  
  return (
    <button 
      type={type} 
      className={`${baseClass} ${variantClass} ${className}`} 
      onClick={onClick}
      {...props}
    >
      {Icon && <Icon size={18} />}
      {children && <span>{children}</span>}
    </button>
  );
};

export default Button;
