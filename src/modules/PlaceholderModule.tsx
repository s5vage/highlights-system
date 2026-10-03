interface Props {
  title: string;
  icon: string;
  note: string;
}

export default function PlaceholderModule({ title, icon, note }: Props) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">{icon}</div>
        <h2 className="text-lg font-semibold text-neutral-100 mb-2">{title}</h2>
        <p className="text-sm text-neutral-500 leading-relaxed">{note}</p>
      </div>
    </div>
  );
}
