import { type ReactNode, useState } from "react";
import { Archive, Brain, ChevronDown, RefreshCw, Trash2 } from "lucide-react";
import type { AuditReport } from "@/lib/types";

type AuditSnapshotCardProps = {
  latest: AuditReport;
  archived: AuditReport[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onArchive: () => Promise<void>;
  canManageArchives: boolean;
  onDeleteArchive: (reportId: string) => Promise<void>;
  onClearArchives: () => Promise<void>;
};

export function AuditSnapshotCard({
  latest,
  archived,
  isRefreshing,
  onRefresh,
  onArchive,
  canManageArchives,
  onDeleteArchive,
  onClearArchives
}: AuditSnapshotCardProps) {
  const [openSection, setOpenSection] = useState<"details" | "questions" | "aiInput" | "history" | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const heatTone =
    latest.signalLevel === "risk"
      ? "border-sell/40 bg-sell/10 text-risk"
      : latest.signalLevel === "watch"
        ? "border-primary/40 bg-primary/10 text-primary-soft"
        : "border-buy/40 bg-buy/10 text-emerald-200";

  const toggleSection = (section: NonNullable<typeof openSection>) => {
    setOpenSection((current) => (current === section ? null : section));
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    if (pendingAction) return;
    setPendingAction(key);
    try {
      await action();
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/30 bg-surface shadow-glow">
      <div className="border-b border-line p-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary-soft" />
          <h2 className="text-lg font-bold text-white">{latest.title}</h2>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary-soft" : ""}`} />
            {isRefreshing ? "分析中" : "AI 分析"}
          </button>
          <button
            type="button"
            onClick={() => void runAction("archive", onArchive)}
            disabled={Boolean(pendingAction)}
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface-raised px-3 text-sm font-bold text-muted-strong transition active:scale-[0.98] disabled:opacity-60"
          >
            <Archive className="h-4 w-4" />
            {pendingAction === "archive" ? "归档中" : "归档分析"}
          </button>
        </div>
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

        <div className="grid grid-cols-2 gap-2">
          <Metric label="记录" value={`${latest.metrics.recordCount} 笔`} />
          <Metric label="复盘覆盖" value={`${latest.metrics.reviewCoverageRate}%`} />
        </div>
      </div>

      <CollapsibleSection title="审计细节" isOpen={openSection === "details"} onToggle={() => toggleSection("details")}>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="犹豫偏差" value={`${latest.metrics.delayedExitRate}%`} />
          <Metric label="计划偏离" value={`${latest.metrics.violationRate}%`} />
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
      </CollapsibleSection>

      <CollapsibleSection title="复盘追问" isOpen={openSection === "questions"} onToggle={() => toggleSection("questions")}>
        <div className="space-y-2 rounded-2xl border border-line bg-background p-3">
          {latest.reviewQuestions.map((question) => (
            <p key={question} className="text-sm leading-6 text-muted-strong">
              {question}
            </p>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="AI 输入摘要" isOpen={openSection === "aiInput"} onToggle={() => toggleSection("aiInput")}>
        <div className="space-y-2">
          {latest.aiInputDigest.map((line) => (
            <div key={line} className="rounded-xl border border-line bg-surface-soft p-3 text-xs leading-5 text-muted-strong">
              {line}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="历史审计快照归档" isOpen={openSection === "history"} onToggle={() => toggleSection("history")}>
        <div className="space-y-2">
          {canManageArchives ? (
            <button
              type="button"
              onClick={() => void runAction("clear", onClearArchives)}
              disabled={Boolean(pendingAction)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-sell/40 bg-sell/10 text-xs font-bold text-risk transition active:scale-[0.98] disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {pendingAction === "clear" ? "清空中" : "清空审计归档"}
            </button>
          ) : null}
          {archived.map((report) => (
            <div key={report.id} className="rounded-xl border border-line bg-surface-soft p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{report.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {report.periodStart} 至 {report.periodEnd} · {report.signalLabel}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">{formatGeneration(report)}</p>
                </div>
                {canManageArchives ? (
                  <button
                    type="button"
                    onClick={() => void runAction(`delete-${report.id}`, () => onDeleteArchive(report.id))}
                    disabled={Boolean(pendingAction)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sell/40 bg-sell/10 text-risk transition active:scale-[0.98] disabled:opacity-60"
                    aria-label="删除审计归档"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-strong">{report.summary}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </section>
  );
}

function formatGeneration(report: AuditReport) {
  const generation = report.generation;
  if (!generation || generation.status === "legacy") return "历史归档 · 来源未记录";
  if (generation.status === "fallback") return `本地规则回退 · ${generation.promptVersion}`;
  if (generation.source === "deepseek") {
    return `${generation.model ?? "DeepSeek"} · ${generation.promptVersion}`;
  }
  return `本地规则 · ${generation.promptVersion}`;
}

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-line">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between p-4 text-left text-sm font-bold text-muted-strong transition active:bg-surface-raised"
      >
        {title}
        <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen ? <div className="space-y-3 bg-background/55 p-4 pt-0">{children}</div> : null}
    </div>
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
