import React from 'react';

export default function SectionHeader({
  title,
  description,
  actions,
  icon: Icon,
  className = '',
  ...props
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-100 ${className}`}
      {...props}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-1 p-2 bg-blue-50 text-blue-600 rounded-lg flex-shrink-0">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-slate-500 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
