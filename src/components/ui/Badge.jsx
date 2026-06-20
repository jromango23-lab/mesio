import React from 'react';

export default function Badge({
  children,
  variant = 'default',
  className = '',
  ...props
}) {
  const baseStyles = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors select-none';
  
  const variants = {
    default: 'bg-slate-100 text-slate-800 border-transparent',
    primary: 'bg-blue-50 text-blue-700 border-blue-100',
    secondary: 'bg-slate-50 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-150',
    warning: 'bg-amber-50 text-amber-700 border-amber-150',
    danger: 'bg-red-50 text-red-700 border-red-150',
    purple: 'bg-purple-50 text-purple-700 border-purple-150',
  };

  return (
    <span
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
