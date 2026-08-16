import { readFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_IMAGE_PLACEHOLDER = "{{SOURCE_IMAGE_NAME}}";
const promptDirectory = path.join(process.cwd(), "docs", "prompts");

type VisionPromptDocuments = {
  system: string;
  userTemplate: string;
  version: string;
};

let productionPromptCache: Promise<VisionPromptDocuments> | null = null;

export async function buildVisionPromptMessages(sourceImageName: string) {
  const prompts = await loadVisionPromptDocuments();
  return {
    promptVersion: prompts.version,
    system: prompts.system,
    user: prompts.userTemplate.replace(SOURCE_IMAGE_PLACEHOLDER, JSON.stringify(sourceImageName))
  };
}

async function loadVisionPromptDocuments() {
  if (process.env.NODE_ENV !== "production") return readVisionPromptDocuments();
  productionPromptCache ??= readVisionPromptDocuments();
  return productionPromptCache;
}

async function readVisionPromptDocuments(): Promise<VisionPromptDocuments> {
  const [system, userTemplate, manifestText] = await Promise.all([
    readPromptFile("vision_system.md"),
    readPromptFile("vision_user.md"),
    readPromptFile("vision_manifest.json")
  ]);
  const placeholderCount = userTemplate.split(SOURCE_IMAGE_PLACEHOLDER).length - 1;
  if (placeholderCount !== 1) {
    throw new Error(`vision_user.md must contain exactly one ${SOURCE_IMAGE_PLACEHOLDER} placeholder.`);
  }
  const manifest = JSON.parse(manifestText) as { version?: unknown };
  if (typeof manifest.version !== "string" || !manifest.version.trim()) {
    throw new Error("vision_manifest.json must contain a non-empty version.");
  }
  return { system, userTemplate, version: manifest.version.trim() };
}

async function readPromptFile(fileName: string) {
  const content = (await readFile(path.join(promptDirectory, fileName), "utf8")).trim();
  if (!content) throw new Error(`${fileName} cannot be empty.`);
  return content;
}
