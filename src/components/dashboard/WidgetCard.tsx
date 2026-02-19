interface WidgetCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function WidgetCard({ title, children, className = '' }: WidgetCardProps) {
  return (
    <div className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 transition-colors duration-300 hover:bg-white/[0.05] ${className}`}>
      <h3 className="text-[11px] uppercase tracking-widest text-white/30 font-medium mb-5 select-none">
        {title}
      </h3>
      {children}
    </div>
  );
}
