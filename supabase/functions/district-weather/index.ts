import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // --- 解析客户端请求 ---
  let districtId = "110108"; // 默认海淀区（高校密集区）
  let dataType = "all";
  try {
    const body = await req.json();
    if (body.district_id) districtId = String(body.district_id);
    if (body.data_type) dataType = String(body.data_type);
  } catch {
    // 允许空 body，使用默认值
  }

  // --- 注入平台密钥（禁止暴露给前端） ---
  const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error: INTEGRATIONS_API_KEY is not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- 调用上游 API ---
  const url = new URL("https://app-e9umlcp7qmm9-api-oLpZbd8ed8wa-gateway.miaoda.online/weather/v1/");
  url.searchParams.set("district_id", districtId);
  url.searchParams.set("data_type", dataType);

  try {
    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Gateway-Authorization": `Bearer ${apiKey}`,
      },
    });

    // 转发配额/余额错误
    if (upstream.status === 429 || upstream.status === 402) {
      const errText = await upstream.text();
      return new Response(errText, {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Network error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
