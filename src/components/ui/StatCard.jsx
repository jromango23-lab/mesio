import React from 'react';

export default function StatCard({
  title,
  value,
  description,
  icon: Icon,
  className = '',
  ...props
}) {
  return (
    <div
      className={`bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200 ${className}`}
      {...props}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {title}
          </span>
          {Icon && (
            <span className="text-slate-450 p-1.5 bg-slate-50 rounded-lg text-slate-500">
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>
        <p className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
          {value}
        </p>
      </div>
      {description && (
        <p className="text-[11px] text-slate-450 mt-3 border-t border-slate-100 pt-2 font-medium text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}
