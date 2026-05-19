import { NextRequest } from "next/server";
import { analyzeProject } from "@/lib/services/analysis-service";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const body = await request.json();

    // 🔥 强制覆盖所有模型，无视前端选择
    body.analysisModel = "ernie-3.5-8k";
    body.pageLayoutModel = "ernie-3.5-8k";
    body.model = "ernie-3.5-8k";

    const result = await analyzeProject(context.params.id, body);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}