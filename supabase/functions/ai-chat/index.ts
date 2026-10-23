import { serve } from "https://deno.land/std/http/server.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  "Content-Type": "application/json",
};

const SYSTEM_PROMPT = [
  "你是「校园萌宠守护档案」应用的 AI 健康助手，服务对象是关心校园流浪猫狗的大学生。",
  "你的专长：流浪猫狗的喂养知识、健康观察、TNR 绝育常识、受伤或患病时的应急处理、领养与救助流程、季节性守护建议。",
  "当用户发送动物照片时（可能附带文字描述），请严格按以下顺序分析：",
  "1. 动物状况评估：先说明看到的动物种类（猫/狗等）、大致年龄与体型、毛发与体态、精神状态；",
  "2. 症状识别：逐条指出照片中可见的异常，如眼角泪痕、皮肤伤口、红肿、脱毛斑、皮肤病、眼鼻分泌物、消瘦、跛行、耳部污垢等；若未见异常，明确说明「未见明显异常」；",
  "3. 健康建议：针对每个症状给出可执行的护理建议（清洁方式、环境改善、饮食调整）与观察要点；",
  "4. 紧急判断：疑似大量出血、骨折、严重皮肤病或传染病迹象时，优先建议尽快联系宠物医院或动物救助组织。",
  "回复要求：",
  "1. 用简体中文，语气温暖友好、简洁易懂，适合大学生阅读；",
  "2. 回答控制在 300 字以内（照片分析可放宽到 400 字），重点突出，分点说明；",
  "3. 涉及医疗、用药时必须提醒遵医嘱，不给出具体药物剂量；",
  "4. 与校园流浪动物无关的问题，礼貌地把话题引导回萌宠守护主题；",
  "5. 输出纯文本，严禁使用任何 Markdown 符号：不用星号 * 做强调或列表、不用 # 做标题、不用 -- 或 --- 做分隔线、不用反引号；需要分点时用「1. 2. 3.」编号，每行一条，自然分段。",
].join("\n");

interface ContentBlock {
  type?: string;
  text?: string;
  image_url?: { url?: string };
}

interface RawMessage {
  role?: string;
  content?: string | ContentBlock[];
}

const isTextBlock = (b: unknown): b is { type: "text"; text: string } => {
  const v = b as { type?: string; text?: string };
  return v?.type === "text" && typeof v.text === "string";
};

const isImageBlock = (b: unknown): b is { type: "image_url"; image_url: { url: string } } => {
  const v = b as { type?: string; image_url?: { url?: string } };
  if (v?.type !== "image_url" || !v.image_url || typeof v.image_url.url !== "string") return false;
  const url = v.image_url.url;
  return url.startsWith("data:image/") || url.startsWith("http://") || url.startsWith("https://");
};

const isValidContent = (c: unknown): boolean => {
  if (typeof c === "string") return c.trim().length > 0;
  return Array.isArray(c) && c.some((b) => isTextBlock(b) || isImageBlock(b));
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  // --- 解析并校验客户端请求 ---
  let rawMessages: unknown;
  try {
    const body = await req.json();
    rawMessages = body.messages;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return new Response(JSON.stringify({ error: "Missing or empty messages" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // --- 注入平台密钥（严禁暴露给前端）---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  // 仅保留合法的多轮对话历史（支持文本与图片混合），限制最近 20 条
  const picked = (rawMessages as RawMessage[])
    .filter((m) => (m.role === "user" || m.role === "assistant") && isValidContent(m.content))
    .slice(-20);

  // 图片额度：整个会话最多保留最近 2 张图，避免上下文过大
  let imageBudget = 2;
  const allowCounts = picked.map((m) => {
    if (typeof m.content === "string") return 0;
    const imgCount = (m.content as ContentBlock[]).filter(isImageBlock).length;
    const keep = Math.min(imgCount, imageBudget);
    imageBudget -= keep;
    return keep;
  });

  const history = picked.map((m, i) => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content.trim().slice(0, 2000) };
    }
    let kept = 0;
    const blocks: ContentBlock[] = [];
    for (const b of m.content as ContentBlock[]) {
      if (isTextBlock(b)) {
        const t = b.text.trim().slice(0, 2000);
        if (t) blocks.push({ type: "text", text: t });
      } else if (isImageBlock(b)) {
        if (kept < allowCounts[i] && b.image_url.url.length <= 6_000_000) {
          blocks.push({ type: "image_url", image_url: { url: b.image_url.url } });
          kept++;
        } else {
          blocks.push({ type: "text", text: "（此前的图片已省略）" });
        }
      }
    }
    return { role: m.role, content: blocks };
  });

  if (history.length === 0) {
    return new Response(JSON.stringify({ error: "No valid messages" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // --- 调用上游（MiniMax-M3 多模态，目标为平台官方网关，硬编码域名）---
  const upstream = await fetch(
    "https://app-e9umlcp7qmm9-api-rLobPAn0n7m9-gateway.miaoda.online/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "MiniMax-M3",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
        thinking: { type: "disabled" },
        max_completion_tokens: 2048,
        temperature: 0.7,
      }),
    }
  );

  if (upstream.status === 429 || upstream.status === 402) {
    return new Response(JSON.stringify({ error: "AI 服务繁忙，请稍后再试" }), {
      status: upstream.status,
      headers: JSON_HEADERS,
    });
  }
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: `Upstream error: ${upstream.status}` }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }

  const data = await upstream.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content) {
    return new Response(JSON.stringify({ error: "AI 返回为空，请重试" }), {
      status: 502,
      headers: JSON_HEADERS,
    });
  }
  return new Response(JSON.stringify({ content }), {
    status: 200,
    headers: JSON_HEADERS,
  });
});