import { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}

export default function StateMessage({ icon, title, body, action }: Props) {
  return (
    <div className="grid place-items-center px-6 py-24 text-center">
      <div className="max-w-xs">
        <span
          className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl"
          style={{ background: 'var(--fill)', color: 'var(--text-dim)' }}
        >
          {icon}
        </span>
        <div className="text-[16px] font-semibold tracking-[-0.012em]">{title}</div>
        <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {body}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}