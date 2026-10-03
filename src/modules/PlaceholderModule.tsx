interface Props {
  title: string;
  icon: string;
  note: string;
}

export default function PlaceholderModule({ title, icon, note }: Props) {
  return (
    <div className="h-full flex items-center justify-center bg-[var(--bg)]">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">{icon}</div>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-2">{title}</h2>
        <p className="text-sm text-[var(--text-faint)] leading-relaxed">{note}</p>
      </div>
    </div>
  );
}