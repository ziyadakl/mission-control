interface WidgetCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Semantic accent color for the top border. Matches Kanban column color system. */
  accent?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'pink' | 'cyan';
}

const ACCENT_BORDER: Record<string, string> = {
  blue:   'border-t-mc-accent',
  green:  'border-t-mc-accent-green',
  yellow: 'border-t-mc-accent-yellow',
  red:    'border-t-mc-accent-red',
  purple: 'border-t-mc-accent-purple',
  pink:   'border-t-mc-accent-pink',
  cyan:   'border-t-mc-accent-cyan',
};

const ACCENT_TINT: Record<string, string> = {
  blue:   'from-mc-accent/5',
  green:  'from-mc-accent-green/5',
  yellow: 'from-mc-accent-yellow/5',
  red:    'from-mc-accent-red/5',
  purple: 'from-mc-accent-purple/5',
  pink:   'from-mc-accent-pink/5',
  cyan:   'from-mc-accent-cyan/5',
};

export function WidgetCard({ title, children, className = '', accent = 'blue' }: WidgetCardProps) {
  return (
    <div className={`widget-card relative bg-mc-bg-secondary border border-mc-border rounded-xl overflow-hidden ${className}`}>
      {/* Colored top border — same pattern as Kanban column headers */}
      <div className={`h-0.5 border-t-2 ${ACCENT_BORDER[accent]}`} />

      {/* Scan-line shimmer overlay */}
      <div className="animate-scan-line absolute inset-0 pointer-events-none rounded-xl" />

      {/* Inner content with subtle accent tint gradient */}
      <div className={`relative bg-gradient-to-b ${ACCENT_TINT[accent]} to-transparent p-4`}>
        <h3 className="text-[10px] uppercase tracking-wider text-mc-text-secondary font-mono mb-3">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
