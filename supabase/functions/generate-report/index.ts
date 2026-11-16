import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ReportRequest {
  period_start: string;
  period_end: string;
  format: "pdf" | "csv";
}

interface ReportMetrics {
  kg_received: number;
  kg_used: number;
  kg_wasted: number;
  waste_percentage: number;
  meals_served: number;
  top_waste_reasons: { reason: string; count: number }[];
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Autenticação via JWT do Supabase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica role (nutritionist ou manager)
    const { data: profile } = await supabase
      .from("user_profile")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["nutritionist", "manager"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ReportRequest = await req.json();
    const { period_start, period_end, format } = body;

    if (!period_start || !period_end || !format) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca doações no período
    const { data: donations, error: donError } = await supabase
      .from("donation")
      .select("id, created_at")
      .gte("created_at", period_start)
      .lte("created_at", period_end);

    if (donError) throw donError;

    const donationIds = donations?.map((d) => d.id) ?? [];

    // Busca itens das doações
    const { data: items, error: itemsError } = await supabase
      .from("item")
      .select("quantity_kg, status, waste_reason")
      .in("donation_id", donationIds);

    if (itemsError) throw itemsError;

    // Calcula métricas
    const metrics = calculateMetrics(items ?? []);

    // Gera arquivo
    let fileContent: Uint8Array;
    let contentType: string;
    let fileName: string;

    if (format === "pdf") {
      fileContent = await generatePDF(metrics, period_start, period_end, user.id);
      contentType = "application/pdf";
      fileName = `relatorio_mesa_farta_${period_start}_${period_end}.pdf`;
    } else {
      fileContent = generateCSV(metrics, period_start, period_end);
      contentType = "text/csv; charset=utf-8";
      fileName = `relatorio_mesa_farta_${period_start}_${period_end}.csv`;
    }

    // Upload para Storage (bucket reports, privado)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("reports")
      .upload(`reports/${fileName}`, fileContent, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Signed URL (expira em 15 min)
    const { data: urlData } = await supabase.storage
      .from("reports")
      .createSignedUrl(uploadData.path, 900); // 15 min

    // Salva registro de relatório
    await supabase.from("report").insert({
      period_start,
      period_end,
      generated_by: user.id,
      pdf_url: format === "pdf" ? urlData?.signedUrl : null,
      csv_url: format === "csv" ? urlData?.signedUrl : null,
      metrics,
    });

    return new Response(
      JSON.stringify({
        pdfUrl: format === "pdf" ? urlData?.signedUrl : null,
        csvUrl: format === "csv" ? urlData?.signedUrl : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("generate-report error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function calculateMetrics(items: any[]): ReportMetrics {
  const kgReceived = items.reduce((sum, i) => sum + Number(i.quantity_kg), 0);
  const kgUsed = items
    .filter((i) => i.status === "servido")
    .reduce((sum, i) => sum + Number(i.quantity_kg), 0);
  const kgWasted = items
    .filter((i) => i.status === "desperdicado")
    .reduce((sum, i) => sum + Number(i.quantity_kg), 0);

  const wasteByReason: Record<string, number> = {
    validade_vencida: 0,
    qualidade_ruim: 0,
    excedente: 0,
    contaminacao: 0,
    outro: 0,
  };

  items
    .filter((i) => i.status === "desperdicado" && i.waste_reason)
    .forEach((i) => {
      if (i.waste_reason in wasteByReason) wasteByReason[i.waste_reason]++;
    });

  const topWasteReasons = Object.entries(wasteByReason)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([reason, count]) => ({ reason, count }));

  return {
    kg_received: kgReceived,
    kg_used: kgUsed,
    kg_wasted: kgWasted,
    waste_percentage: kgReceived > 0 ? (kgWasted / kgReceived) * 100 : 0,
    meals_served: Math.floor(kgUsed / 0.4), // ~400g por refeição
    top_waste_reasons: topWasteReasons,
  };
}

function generateCSV(metrics: ReportMetrics, periodStart: string, periodEnd: string): Uint8Array {
  const lines = [
    "Métrica,Valor",
    `Período,${periodStart} a ${periodEnd}`,
    `Kg Recebidos,${metrics.kg_received.toFixed(3)}`,
    `Kg Utilizados,${metrics.kg_used.toFixed(3)}`,
    `Kg Desperdiçados,${metrics.kg_wasted.toFixed(3)}`,
    `% Desperdício,${metrics.waste_percentage.toFixed(2)}%`,
    `Refeições Servidas,${metrics.meals_served}`,
    "",
    "Motivo Desperdício,Contagem",
    ...metrics.top_waste_reasons.map((r) => `${r.reason},${r.count}`),
  ];

  // UTF-8 BOM para Excel abrir corretamente
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const csv = lines.join("\n");
  const content = new TextEncoder().encode(csv);
  const result = new Uint8Array(bom.length + content.length);
  result.set(bom);
  result.set(content, bom.length);
  return result;
}

async function generatePDF(
  metrics: ReportMetrics,
  periodStart: string,
  periodEnd: string,
  userId: string
): Promise<Uint8Array> {
  // PDF simples usando formatação manual (para evitar dependências pesadas no Deno)
  // Em produção, use pdfmake ou @react-pdf/renderer via bundle

  const content = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 0 R >>
stream
BT
/F1 14 Tf
50 780 Td
(Relatório Mesa Farta) Tj
0 -25 Td
/F1 10 Tf
(Período: ${periodStart} a ${periodEnd}) Tj
0 -20 Td
(Kg Recebidos: ${metrics.kg_received.toFixed(3)}) Tj
0 -15 Td
(Kg Utilizados: ${metrics.kg_used.toFixed(3)}) Tj
0 -15 Td
(Kg Desperdiçados: ${metrics.kg_wasted.toFixed(3)}) Tj
0 -15 Td
(% Desperdício: ${metrics.waste_percentage.toFixed(2)}%) Tj
0 -15 Td
(Refeições Servidas: ${metrics.meals_served}) Tj
0 -25 Td
(Top 3 Motivos de Desperdício:) Tj
${metrics.top_waste_reasons.map((r, i) => `0 -15 Td (${i+1}. ${r.reason}: ${r.count}) Tj`).join("\n")}
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
44 0 obj
${1000}
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000117 00000 n
0000000215 00000 n
0000000700 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
800
%%EOF
  `.trim();

  return new TextEncoder().encode(content);
}