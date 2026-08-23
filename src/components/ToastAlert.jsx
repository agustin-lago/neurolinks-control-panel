import React from 'react';

export default function ToastAlert({ type, title, message, theme, onClose }) {
  // Convert type to match the provided ones (success, error, warning, info)
  let alertType = type;
  if (type === 'danger') alertType = 'error';

  // Make sure we have a fallback
  if (!['success', 'error', 'warning', 'info', 'loading'].includes(alertType)) {
    alertType = 'info';
  }

  const isDark = theme === 'dark';

  if (alertType === 'success') {
    if (isDark) {
      return (
        <div role="alert" className="rounded-md border border-green-500 bg-green-50 p-4 shadow-sm dark:border-green-400 dark:bg-green-800 relative w-full mb-2 pointer-events-auto">
          <button onClick={onClose} className="absolute top-2 right-2 text-green-700 dark:text-green-200 hover:opacity-75">
            <i className="bi bi-x-lg text-sm"></i>
          </button>
          <div className="flex items-start gap-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 text-green-700 dark:text-green-200">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 pr-4">
              <strong className="block leading-tight font-medium text-green-800 dark:text-green-100">{title || 'Success'}</strong>
              <p className="mt-0.5 text-sm text-green-700 dark:text-green-200">{message}</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div role="alert" className="rounded-md border border-green-500 bg-green-50 p-4 shadow-sm relative w-full mb-2 pointer-events-auto">
        <button onClick={onClose} className="absolute top-2 right-2 text-green-700 hover:opacity-75">
          <i className="bi bi-x-lg text-sm"></i>
        </button>
        <div className="flex items-start gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 text-green-700">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 pr-4">
            <strong className="block leading-tight font-medium text-green-800">{title || 'Success'}</strong>
            <p className="mt-0.5 text-sm text-green-700">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (alertType === 'error') {
    if (isDark) {
      return (
        <div role="alert" className="rounded-md border border-red-500 bg-red-50 p-4 shadow-sm dark:border-red-400 dark:bg-red-800 relative w-full mb-2 pointer-events-auto">
          <button onClick={onClose} className="absolute top-2 right-2 text-red-700 dark:text-red-200 hover:opacity-75">
            <i className="bi bi-x-lg text-sm"></i>
          </button>
          <div className="flex items-start gap-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 text-red-700 dark:text-red-200">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div className="flex-1 pr-4">
              <strong className="block leading-tight font-medium text-red-800 dark:text-red-100">{title || 'Error'}</strong>
              <p className="mt-0.5 text-sm text-red-700 dark:text-red-200">{message}</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div role="alert" className="rounded-md border border-red-500 bg-red-50 p-4 shadow-sm relative w-full mb-2 pointer-events-auto">
        <button onClick={onClose} className="absolute top-2 right-2 text-red-700 hover:opacity-75">
          <i className="bi bi-x-lg text-sm"></i>
        </button>
        <div className="flex items-start gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 text-red-700">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <div className="flex-1 pr-4">
            <strong className="block leading-tight font-medium text-red-800">{title || 'Error'}</strong>
            <p className="mt-0.5 text-sm text-red-700">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (alertType === 'warning') {
    if (isDark) {
      return (
        <div role="alert" className="rounded-md border border-amber-500 bg-amber-50 p-4 shadow-sm dark:border-amber-400 dark:bg-amber-800 relative w-full mb-2 pointer-events-auto">
          <button onClick={onClose} className="absolute top-2 right-2 text-amber-700 dark:text-amber-200 hover:opacity-75">
            <i className="bi bi-x-lg text-sm"></i>
          </button>
          <div className="flex items-start gap-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 text-amber-700 dark:text-amber-200">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div className="flex-1 pr-4">
              <strong className="block leading-tight font-medium text-amber-800 dark:text-amber-100">{title || 'Warning'}</strong>
              <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-200">{message}</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div role="alert" className="rounded-md border border-amber-500 bg-amber-50 p-4 shadow-sm relative w-full mb-2 pointer-events-auto">
        <button onClick={onClose} className="absolute top-2 right-2 text-amber-700 hover:opacity-75">
          <i className="bi bi-x-lg text-sm"></i>
        </button>
        <div className="flex items-start gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 text-amber-700">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div className="flex-1 pr-4">
            <strong className="block leading-tight font-medium text-amber-800">{title || 'Warning'}</strong>
            <p className="mt-0.5 text-sm text-amber-700">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  // Info
  if (isDark) {
    return (
      <div role="alert" className="rounded-md border border-blue-500 bg-blue-50 p-4 shadow-sm dark:border-blue-400 dark:bg-blue-800 relative w-full mb-2 pointer-events-auto">
        <button onClick={onClose} className="absolute top-2 right-2 text-blue-700 dark:text-blue-200 hover:opacity-75">
          <i className="bi bi-x-lg text-sm"></i>
        </button>
        <div className="flex items-start gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 text-blue-700 dark:text-blue-200">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <div className="flex-1 pr-4">
            <strong className="block leading-tight font-medium text-blue-800 dark:text-blue-100">{title || 'Info'}</strong>
            <p className="mt-0.5 text-sm text-blue-700 dark:text-blue-200">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (alertType === 'loading') {
    if (isDark) {
      return (
        <div role="alert" className="rounded-md border border-blue-500 bg-blue-50 p-4 shadow-sm dark:border-blue-400 dark:bg-blue-800 relative w-full mb-2 pointer-events-auto">
          <div className="flex items-start gap-4">
            <div className="spinner-border spinner-border-sm text-blue-700 dark:text-blue-200 mt-1" role="status" style={{ width: '1.2rem', height: '1.2rem', borderWidth: '0.15em' }}></div>
            <div className="flex-1 pr-4">
              <strong className="block leading-tight font-medium text-blue-800 dark:text-blue-100">{title || 'Cargando...'}</strong>
              <p className="mt-0.5 text-sm text-blue-700 dark:text-blue-200">{message}</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div role="alert" className="rounded-md border border-blue-500 bg-blue-50 p-4 shadow-sm relative w-full mb-2 pointer-events-auto">
        <div className="flex items-start gap-4">
          <div className="spinner-border spinner-border-sm text-blue-700 mt-1" role="status" style={{ width: '1.2rem', height: '1.2rem', borderWidth: '0.15em' }}></div>
          <div className="flex-1 pr-4">
            <strong className="block leading-tight font-medium text-blue-800">{title || 'Cargando...'}</strong>
            <p className="mt-0.5 text-sm text-blue-700">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-md border border-blue-500 bg-blue-50 p-4 shadow-sm relative w-full mb-2 pointer-events-auto">
      <button onClick={onClose} className="absolute top-2 right-2 text-blue-700 hover:opacity-75">
        <i className="bi bi-x-lg text-sm"></i>
      </button>
      <div className="flex items-start gap-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="-mt-0.5 size-6 text-blue-700">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
        <div className="flex-1 pr-4">
          <strong className="block leading-tight font-medium text-blue-800">{title || 'Info'}</strong>
          <p className="mt-0.5 text-sm text-blue-700">{message}</p>
        </div>
      </div>
    </div>
  );
}
