import React from 'react';

type Props = {
  children: React.ReactNode;
};

export function PageShell({ children }: Props) {
  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: '16px',
      boxSizing: 'border-box',
      width: '100%',
    }}>
      <div style={{
        background: 'var(--background, #fff)',
        borderRadius: 8,
        padding: 16,
        overflowX: 'auto',
      }}>
        {children}
      </div>
    </div>
  );
}
