import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-background/45 p-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised text-primary-soft">
        <Icon className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="mt-2 max-w-64 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}
