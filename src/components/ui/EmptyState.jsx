import React from 'react';

export default function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className = '',
  ...props
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 border border-slate-200 border-dashed rounded-xl bg-slate-50/50 ${className}`}
      {...props}
    >
      {Icon && (
        <div className="p-3 bg-slate-100 text-slate-400 rounded-full mb-4">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-sm font-bold text-slate-800">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
}
