import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'emerald' | 'rose' | 'amber' | 'slate' | 'indigo' | 'blue';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'slate', size = 'sm' }) => {
  const variants = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-600/10',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-600/10',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-600/10',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-1 ring-indigo-600/10',
    blue: 'bg-sky-50 text-sky-700 border-sky-200 ring-1 ring-sky-600/10',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-0.5 rounded-full font-medium',
    md: 'text-sm px-3 py-1 rounded-full font-semibold',
  };

  return (
    <span className={`inline-flex items-center border ${variants[variant]} ${sizes[size]} transition-colors`}>
      {children}
    </span>
  );
};
