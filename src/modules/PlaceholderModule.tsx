import { MODULES } from '@/lib/modules';

interface Props {
  title: string;
  icon: string;
  note: string;
}

export default function PlaceholderModule({ title, icon, note }: Props) {
  const mod = MODULES.find((m) => m.label === title);
  const Icon = mod?.icon;

  return (
    <div className="grid h-full place-items-center px-6" style={{ background: 'var(--bg)' }}>
      <div className="max-w-sm text-center">
        <span
          className="tile-badge mx-auto mb-5"
          style={{ '--hue': `var(--hue-${mod?.hue ?? 'gray'})`, width: 56, height: 56, borderRadius: 18 } as React.CSSProperties}
        >
          {Icon ? <Icon size={26} strokeWidth={1.7} /> : <span className="text-2xl">{icon}</span>}
        </span>
        <h2 className="text-[20px] font-semibold tracking-[-0.018em]">{title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {note}
        </p>
      </div>
    </div>
  );
}