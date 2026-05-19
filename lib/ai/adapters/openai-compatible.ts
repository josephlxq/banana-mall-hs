import { z } from "zod";
import type {
  AiMonitorContext,
  ImageEditRequest,
  ImageGenerationRequest,
  ImageGenerationResult,
  ProviderAdapter,
  StructuredRequest,
  TextRequest,
} from "@/lib/ai/provider-client";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

// 【关键修复】构建带图片的消息格式
function buildMessagesWithImage(input: TextRequest | StructuredRequest<unknown>) {
  const msgs = [];
  
  // 1. 先把 system prompt 作为 user 消息（百度不支持单独的 system 角色）
  if (input.systemPrompt) {
    msgs.push({ role: "user", content: input.systemPrompt });
  }

  // 2. 处理用户消息和图片（百度多模态要求的格式）
  if (input.images && input.images.length > 0) {
    // 有图片，构建多模态消息
    const content = [];
    // 文本部分
    if (input.userPrompt) {
      content.push({ type: "text", text: input.userPrompt });
    }
    // 图片部分（必须是数组里的对象）
    input.images.forEach(imgUrl => {
      content.push({ type: "image_url", image_url: { url: imgUrl } });
    });
    msgs.push({ role: "user", content: content });
  } else {
    // 没有图片，纯文本
    msgs.push({ role: "user", content: input.userPrompt });
  }

  return msgs;
}

function safeJsonParse(text: string) {
  try {
    let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) cleaned = match[0];
    return JSON.parse(cleaned);
  } catch {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  async testConnection() {
    try {
      const res = await fetch(`${normalizeBaseUrl(this.baseUrl)}/v2/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "ernie-4.5-0.3b",
          messages: [{ role: "user", content: "hello" }],
          stream: false,
        }),
      });
      return { ok: res.ok, providerLabel: "百度ERNIE 4.5" };
    } catch {
      return { ok: false, providerLabel: "百度ERNIE 4.5" };
    }
  }

  async listModels() {
    return [{ id: "ernie-4.5-0.3b", label: "百度ERNIE 4.5" }];
  }

  async generateText(input: TextRequest) {
    try {
      const res = await fetch(`${normalizeBaseUrl(this.baseUrl)}/v2/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "ernie-4.5-0.3b",
          messages: buildMessagesWithImage(input),
          stream: false,
        }),
      });

      const data = await res.json();
      const text = data?.result || "";
      return { text };
    } catch (e) {
      console.error("generateText", e);
      return { text: "分析失败" };
    }
  }

  async generateStructured<T>(input: StructuredRequest<T>) {
    try {
      const res = await fetch(`${normalizeBaseUrl(this.baseUrl)}/v2/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "ernie-4.5-0.3b",
          messages: buildMessagesWithImage(input),
          stream: false,
        }),
      });

      const data = await res.json();
      const text = data?.result || "{}";
      const parsed = safeJsonParse(text);

      return { parsed, raw: text };
    } catch (e) {
      console.error("generateStructured", e);
      return { parsed: {}, raw: "{}" };
    }
  }

  async probeImageEndpointSupport() {
    return { imageGeneration: "unavailable", imageEdit: "unavailable", note: "" };
  }

  async generateImage(input: ImageGenerationRequest): Promise<ImageGenerationResult> { throw new Error("not supported"); }
  async editImage(input: ImageEditRequest): Promise<ImageGenerationResult> { throw new Error("not supported"); }
}

export function parseProviderError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "error";
}