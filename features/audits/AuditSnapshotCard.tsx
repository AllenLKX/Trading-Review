import { Brain, ChevronDown, RefreshCw } from "lucide-react";
import type { AuditReport } from "@/lib/types";

type AuditSnapshotCardProps = {
  latest: AuditReport;
  archived: AuditReport[];
};

export function AuditSnapshotCard({ latest, archived }: AuditSnapshotCardProps) {
  const heatTone =
    latest.signalLevel === "risk"
      ? "border-sell/40 bg-sell/10 text-risk"
      : latest.signalLevel === "watch"
        ? "border-primary/40 bg-primary/10 text-primary-soft"
        : "border-buy/40 bg-buy/10 text-emerald-200";

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/30 bg-surface shadow-glow">
      <div className="flex items-center justify-between border-b border-line p-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary-soft" />
          <h2 className="text-lg font-bold text-white">{latest.title}</h2>
        </div>
        <button type="button" aria-label="刷新审计" className="rounded-full p-2 text-muted active:bg-surface-raised">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-muted">
            评估周期：{latest.periodStart} 至 {latest.periodEnd}
          </p>
          <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${heatTone}`}>
            情绪热度 {latest.metrics.emotionHeat}%
          </span>
        </div>

        <p className="text-sm leading-7 text-muted-strong">
          <span className="font-bold text-white">{latest.signalLabel}：</span>
          {latest.summary}
        </p>

        <div className="grid grid-cols-3 gap-2">
          <Metric label="记录" value={`${latest.metrics.recordCount} 笔`} />
          <Metric label="犹豫偏差" value={`${latest.metrics.delayedExitRate}%`} />
          <Metric label="状态" value={latest.signalLabel} />
        </div>

        <div className="space-y-2 rounded-2xl bg-background p-3">
          {latest.findings.map((finding) => (
            <div key={finding} className="flex gap-2 text-sm text-muted-strong">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-soft" />
              <span>{finding}</span>
            </div>
          ))}
        </div>
      </div>

      <details className="border-t border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-bold text-muted-strong">
          历史审计快照归档
          <ChevronDown className="h-4 w-4" />
        </summary>
        <div className="space-y-2 bg-background/55 p-4 pt-0">
          {archived.map((report) => (
            <div key={report.id} className="rounded-xl border border-line bg-surface-soft p-3">
              <p className="text-sm font-bold text-white">{report.title}</p>
              <p className="mt-1 text-xs text-muted">
                {report.periodStart} 至 {report.periodEnd} · {report.signalLabel}
              </p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-background p-3">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
    </div>
  );
}
