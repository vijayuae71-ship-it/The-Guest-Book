import React, { forwardRef } from 'react';

const Input = forwardRef(function Input(
  { label, error, icon: Icon, className = '', ...props },
  ref
) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
            <Icon size={18} />
          </div>
        )}
        <input
          ref={ref}
          className={`
            w-full bg-slate-800/50 border border-slate-700 rounded-xl
            px-4 py-2.5 text-slate-100 placeholder:text-slate-500
            focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
            transition-all duration-200
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
});

export default Input;
