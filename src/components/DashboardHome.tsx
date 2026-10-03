import { MODULES } from '@/lib/modules';
import { ModuleId } from '@/lib/types';

interface Props {
  onOpenModule: (id: ModuleId) => void;
}

export default function DashboardHome({ onOpenModule }: Props) {
  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-neutral-100 mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-neutral-500">
            Pick a module to open it in a new tab.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <button
              key={m.id}
              onClick={() => onOpenModule(m.id)}
              className="group text-left bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 hover:-translate-y-0.5 transition-all"
            >
              <div
                className={`w-9 h-9 rounded-lg ${m.accent} bg-opacity-15 flex items-center justify-center text-lg mb-3`}
              >
                {m.icon}
              </div>
              <div className="text-sm font-semibold text-neutral-100 mb-1">
                {m.label}
              </div>
              <div className="text-xs text-neutral-500 leading-relaxed">
                {m.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
