import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AuditAiRequest } from "@/lib/audit-ai-adapter";

const AUDIT_INPUT_PLACEHOLDER = "{{AUDIT_INPUT_JSON}}";
const promptDirectory = path.join(process.cwd(), "docs", "prompts");

type AuditPromptDocuments = {
  system: string;
  userTemplate: string;
};

let productionPromptCache: Promise<AuditPromptDocuments> | null = null;

export async function buildAuditPromptMessages(aiRequest: AuditAiRequest) {
  const prompts = await loadAuditPromptDocuments();

  return [
    { role: "system", content: prompts.system },
    {
      role: "user",
      content: prompts.userTemplate.replace(AUDIT_INPUT_PLACEHOLDER, JSON.stringify(aiRequest))
    }
  ];
}

async function loadAuditPromptDocuments() {
  if (process.env.NODE_ENV !== "production") return readAuditPromptDocuments();

  productionPromptCache ??= readAuditPromptDocuments();
  return productionPromptCache;
}

async function readAuditPromptDocuments(): Promise<AuditPromptDocuments> {
  const [system, userTemplate] = await Promise.all([
    readPromptFile("audit_system.md"),
    readPromptFile("audit_user.md")
  ]);

  const placeholderCount = userTemplate.split(AUDIT_INPUT_PLACEHOLDER).length - 1;
  if (placeholderCount !== 1) {
    throw new Error(`audit_user.md must contain exactly one ${AUDIT_INPUT_PLACEHOLDER} placeholder.`);
  }

  return { system, userTemplate };
}

async function readPromptFile(fileName: string) {
  const content = (await readFile(path.join(promptDirectory, fileName), "utf8")).trim();
  if (!content) throw new Error(`${fileName} cannot be empty.`);
  return content;
}
