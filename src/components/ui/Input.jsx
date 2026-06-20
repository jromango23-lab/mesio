import React from 'react';

export default function Input({
  label,
  error,
  className = '',
  type = 'text',
  ...props
}) {
  const inputStyles = `block w-full rounded-lg bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500 text-sm p-2.5 border transition-all shadow-sm ${
    error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
  }`;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          {label}
        </label>
      )}
      {type === 'select' ? (
        <select
          className={`${inputStyles} ${className}`}
          {...props}
        />
      ) : type === 'textarea' ? (
        <textarea
          className={`${inputStyles} ${className}`}
          {...props}
        />
      ) : (
        <input
          type={type}
          className={`${inputStyles} ${className}`}
          {...props}
        />
      )}
      {error && (
        <p className="mt-1 text-xs text-red-650 font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
