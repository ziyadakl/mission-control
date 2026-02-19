type Accent = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink' | 'cyan';

interface WidgetCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  accent?: Accent;
}

const ACCENT_BORDER: Record<Accent, string> = {
  blue: 'border-t-mc-accent/40',
  green: 'border-t-mc-accent-green/40',
  yellow: 'border-t-mc-accent-yellow/40',
  red: 'border-t-mc-accent-red/40',
  purple: 'border-t-mc-accent-purple/40',
  pink: 'border-t-mc-accent-pink/40',
  cyan: 'border-t-mc-accent-cyan/40',
};

export function WidgetCard({ title, children, className = '', accent }: WidgetCardProps) {
  const borderClass = accent ? `border-t-2 ${ACCENT_BORDER[accent]}` : '';

  return (
    <div className={`widget-card bg-mc-bg-secondary/50 border border-mc-border/30 rounded-lg p-5 ${borderClass} ${className}`}>
      <h3 className="text-[10px] uppercase tracking-[0.15em] text-mc-text-secondary/50 font-mono mb-4 select-none">
        {title}
      </h3>
      {children}
    </div>
  );
}
