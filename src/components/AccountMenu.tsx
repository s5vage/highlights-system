'use client';

import { BarChart3, LogOut, SlidersHorizontal, Trash2 } from 'lucide-react';
import Popover from '@/components/Popover';
import { useAuth } from '@/lib/auth';

// Asks the page to open a tab. (The page listens for this, so the tab bar needs no changes.)
function openTab(id: string) {
  window.dispatchEvent(new CustomEvent('hl-open-module', { detail: { id } }));
}

// A round button with your initial. Put it in the tab bar, next to the theme button.
export default function AccountMenu() {
  const { user, isAdmin, signOut } = useAuth();
  if (!user) return null;
  const email = user.email ?? 'Signed in';
  const name = (user.user_metadata?.name as string | undefined)?.trim();

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
          className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          style={{ background: 'var(--fill-strong)', color: 'var(--text)', boxShadow: 'inset 0 0 0 1px var(--hairline)' }}
        >
          {(name || email).slice(0, 1).toUpperCase()}
        </button>
      )}
    >
      {(close) => (
        <div className="min-w-[220px]">
          <div className="px-2.5 pb-2 pt-1.5">
            {name && <div className="truncate text-[13.5px] font-semibold">{name}</div>}
            <div className="truncate text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
              {email}
            </div>
          </div>
          <div className="mx-1 my-1 h-px" style={{ background: 'var(--border)' }} />
          <button type="button" className="menu-item" onClick={() => { close(); openTab('settings'); }}>
            <SlidersHorizontal size={15} strokeWidth={1.9} /> Settings
          </button>
          <button type="button" className="menu-item" onClick={() => { close(); openTab('trash'); }}>
            <Trash2 size={15} strokeWidth={1.9} /> Trash
          </button>
          {isAdmin && (
            <a href="/admin" className="menu-item" onClick={close}>
              <BarChart3 size={15} strokeWidth={1.9} /> Usage
            </a>
          )}
          <div className="mx-1 my-1 h-px" style={{ background: 'var(--border)' }} />
          <button type="button" className="menu-item" onClick={() => { close(); signOut(); }}>
            <LogOut size={15} strokeWidth={1.9} /> Sign out
          </button>
        </div>
      )}
    </Popover>
  );
}