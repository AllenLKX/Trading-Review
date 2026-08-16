import { readFile } from "node:fs/promises";
import path from "node:path";

import type { OcrTextLine } from "@/lib/server/tencent-ocr";

const OCR_INPUT_PLACEHOLDER = "{{OCR_INPUT_JSON}}";
const promptDirectory = path.join(process.cwd(), "docs", "prompts");

type RecognitionPromptDocuments = {
  system: string;
  userTemplate: string;
  version: string;
};

let productionPromptCache: Promise<RecognitionPromptDocuments> | null = null;

export async function buildRecognitionPromptMessages(input: { sourceImageName: string; lines: OcrTextLine[] }) {
  const prompts = await loadRecognitionPromptDocuments();

  return {
    promptVersion: prompts.version,
    messages: [
      { role: "system", content: prompts.system },
      {
        role: "user",
        content: prompts.userTemplate.replace(OCR_INPUT_PLACEHOLDER, JSON.stringify(input))
      }
    ]
  };
}

async function loadRecognitionPromptDocuments() {
  if (process.env.NODE_ENV !== "production") return readRecognitionPromptDocuments();
  productionPromptCache ??= readRecognitionPromptDocuments();
  return productionPromptCache;
}

async function readRecognitionPromptDocuments(): Promise<RecognitionPromptDocuments> {
  const [system, userTemplate, manifestText] = await Promise.all([
    readPromptFile("recognition_system.md"),
    readPromptFile("recognition_user.md"),
    readPromptFile("recognition_manifest.json")
  ]);
  const placeholderCount = userTemplate.split(OCR_INPUT_PLACEHOLDER).length - 1;
  if (placeholderCount !== 1) {
    throw new Error(`recognition_user.md must contain exactly one ${OCR_INPUT_PLACEHOLDER} placeholder.`);
  }
  const manifest = JSON.parse(manifestText) as { version?: unknown };
  if (typeof manifest.version !== "string" || !manifest.version.trim()) {
    throw new Error("recognition_manifest.json must contain a non-empty version.");
  }
  return { system, userTemplate, version: manifest.version.trim() };
}

async function readPromptFile(fileName: string) {
  const content = (await readFile(path.join(promptDirectory, fileName), "utf8")).trim();
  if (!content) throw new Error(`${fileName} cannot be empty.`);
  return content;
}
