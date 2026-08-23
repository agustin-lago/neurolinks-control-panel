import React from 'react';

export default function Skeleton({ variant = 'text', className = '', style = {} }) {
  const baseClass = 'animate-pulse bg-black/10 dark:bg-white/10';

  if (variant === 'card') {
    return (
      <div className={`glass-card rounded-xl animate-pulse ${className}`} style={style}></div>
    );
  }

  if (variant === 'complex-card') {
    return (
      <div className={`glass-card p-6 flex flex-col gap-4 animate-pulse ${className}`} style={style}>
        <div className="flex items-center gap-4">
          <div className={`${baseClass} w-12 h-12 rounded-full shrink-0`}></div>
          <div className="flex-1">
            <div className={`${baseClass} h-5 w-1/3 rounded mb-2`}></div>
            <div className={`${baseClass} h-3 w-1/4 rounded`}></div>
          </div>
        </div>
        <div className={`${baseClass} h-4 w-full rounded`}></div>
        <div className={`${baseClass} h-4 w-5/6 rounded`}></div>
        <div className="flex items-center gap-2 mt-2">
          <div className={`${baseClass} h-8 w-20 rounded-full`}></div>
          <div className={`${baseClass} h-8 w-24 rounded-full`}></div>
        </div>
      </div>
    );
  }

  if (variant === 'list-item') {
    return (
      <div className={`flex items-center gap-3 py-3 border-b border-[var(--border-light)] ${className}`} style={style}>
        <div className={`${baseClass} w-10 h-10 rounded-full shrink-0`}></div>
        <div className="flex-1">
          <div className={`${baseClass} h-4 w-1/3 rounded mb-1.5`}></div>
          <div className={`${baseClass} h-3 w-1/4 rounded`}></div>
        </div>
        <div className={`${baseClass} h-8 w-16 rounded shrink-0`}></div>
      </div>
    );
  }

  if (variant === 'chat-bubble') {
    return (
      <div className={`flex gap-3 mb-4 ${className}`} style={style}>
        <div className={`${baseClass} w-8 h-8 rounded-full shrink-0`}></div>
        <div className="flex flex-col gap-1 w-full max-w-[75%]">
          <div className={`${baseClass} h-16 w-full rounded-2xl rounded-tl-sm`}></div>
          <div className={`${baseClass} h-3 w-12 rounded ml-1`}></div>
        </div>
      </div>
    );
  }

  if (variant === 'button') {
    return <div className={`${baseClass} h-9 rounded-md w-24 ${className}`} style={style}></div>;
  }

  if (variant === 'avatar' || variant === 'circle') {
    return <div className={`${baseClass} rounded-full w-10 h-10 ${className}`} style={style}></div>;
  }

  if (variant === 'title') {
    return <div className={`${baseClass} h-6 w-1/3 rounded ${className}`} style={style}></div>;
  }

  // Default: text
  return <div className={`${baseClass} h-4 w-full rounded ${className}`} style={style}></div>;
}
