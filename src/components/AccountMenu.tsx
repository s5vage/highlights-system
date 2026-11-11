'use client';

import { BarChart3, LogOut } from 'lucide-react';
import Popover from '@/components/Popover';
import { useAuth } from '@/lib/auth';

// A round button with your initial. Put it in the tab bar, next to the theme button.
export default function AccountMenu() {
  const { user, isAdmin, signOut } = useAuth();
  if (!user) return null;
  const email = user.email ?? 'Signed in';

  return (
    <Popover
      align="right"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label="Account"
          aria-expanded={open}
          title={email}
          className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
        >
          {email.slice(0, 1).toUpperCase()}
        </button>
      )}
    >
      {(close) => (
        <div className="min-w-[220px]">
          <div className="px-2.5 pb-2 pt-1.5">
            <div className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              Signed in as
            </div>
            <div className="truncate text-[13.5px] font-semibold">{email}</div>
          </div>
          <div className="mx-1 my-1 h-px" style={{ background: 'var(--border)' }} />
          {isAdmin && (
            <a href="/admin" className="menu-item" onClick={close}>
              <BarChart3 size={15} strokeWidth={1.9} /> Usage
            </a>
          )}
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              close();
              signOut();
            }}
          >
            <LogOut size={15} strokeWidth={1.9} /> Sign out
          </button>
        </div>
      )}
    </Popover>
  );
}