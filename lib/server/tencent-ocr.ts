import { ocr } from "tencentcloud-sdk-nodejs-ocr";

const MAX_OCR_LINES = 300;

export type OcrTextLine = {
  text: string;
  confidence: number;
  x: number;
  y: number;
};

export type TencentOcrResult =
  | { ok: true; lines: OcrTextLine[]; requestId?: string }
  | { ok: false; reason: "not-configured" | "provider-error" };

export async function recognizeImageText(imageBase64: string): Promise<TencentOcrResult> {
  const secretId = (process.env.TENCENT_OCR_SECRET_ID ?? process.env.TENCENT_COS_SECRET_ID)?.trim();
  const secretKey = (process.env.TENCENT_OCR_SECRET_KEY ?? process.env.TENCENT_COS_SECRET_KEY)?.trim();
  if (!secretId || !secretKey) return { ok: false, reason: "not-configured" };

  const Client = ocr.v20181119.Client;
  const client = new Client({
    credential: { secretId, secretKey },
    region: process.env.TENCENT_OCR_REGION?.trim() || process.env.TENCENT_COS_REGION?.trim() || "ap-guangzhou",
    profile: {
      httpProfile: {
        endpoint: "ocr.tencentcloudapi.com",
        reqTimeout: 30
      }
    }
  });

  try {
    const response = await client.GeneralAccurateOCR({
      ImageBase64: imageBase64,
      EnableDetectSplit: true,
      WordsType: "2"
    });
    const lines = (response.TextDetections ?? [])
      .map((item) => ({
        text: item.DetectedText?.trim() ?? "",
        confidence: clampConfidence(item.Confidence),
        x: Math.max(0, Math.round(item.ItemPolygon?.X ?? 0)),
        y: Math.max(0, Math.round(item.ItemPolygon?.Y ?? 0))
      }))
      .filter((item) => item.text)
      .sort((left, right) => left.y - right.y || left.x - right.x)
      .slice(0, MAX_OCR_LINES);

    return { ok: true, lines, requestId: response.RequestId };
  } catch (error) {
    console.error("Tencent OCR request failed", error instanceof Error ? { name: error.name, message: error.message } : error);
    return { ok: false, reason: "provider-error" };
  }
}

function clampConfidence(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value ?? 0));
}
