import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple Code128B barcode generator → SVG
function code128B(text: string): string {
  const START_B = 104;
  const STOP = 106;
  const patterns = [
    "11011001100","11001101100","11001100110","10010011000","10010001100",
    "10001001100","10011001000","10011000100","10001100100","11001001000",
    "11001000100","11000100100","10110011100","10011011100","10011001110",
    "10111001100","10011101100","10011100110","11001110010","11001011100",
    "11001001110","11011100100","11001110100","11100101100","11100100110",
    "11101100100","11100110100","11100110010","11011011000","11011000110",
    "11000110110","10100011000","10001011000","10001000110","10110001000",
    "10001101000","10001100010","11010001000","11000101000","11000100010",
    "10110111000","10110001110","10001101110","10111011000","10111000110",
    "10001110110","11101110110","11010001110","11000101110","11011101000",
    "11011100010","11011101110","11101011000","11101000110","11100010110",
    "11101101000","11101100010","11100011010","11101111010","11001000010",
    "11110001010","10100110000","10100001100","10010110000","10010000110",
    "10000101100","10000100110","10110010000","10110000100","10011010000",
    "10011000010","10000110100","10000110010","11000010010","11001010000",
    "11110111010","11000010100","10001111010","10100111100","10010111100",
    "10010011110","10111100100","10011110100","10011110010","11110100100",
    "11110010100","11110010010","11011011110","11011110110","11110110110",
    "10101111000","10100011110","10001011110","10111101000","10111100010",
    "11110101000","11110100010","10111011110","10111101110","11101011110",
    "11110101110","11010000100","11010010000","11010011100","1100011101011",
  ];

  let checksum = START_B;
  const indices = [START_B];
  for (let i = 0; i < text.length; i++) {
    const idx = text.charCodeAt(i) - 32;
    indices.push(idx);
    checksum += idx * (i + 1);
  }
  indices.push(checksum % 103);
  indices.push(STOP);

  let bits = "";
  for (const idx of indices) bits += patterns[idx];

  const barWidth = 2;
  const height = 60;
  const width = bits.length * barWidth;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") {
      svg += `<rect x="${i * barWidth}" y="0" width="${barWidth}" height="${height}" fill="#000"/>`;
    }
  }
  svg += `</svg>`;
  return svg;
}

function buildLabelHtml(
  box: any,
  shipment: any,
  senderAddr: any,
  receiverAddr: any,
  company: any
): string {
  const vol = parseFloat(box.volume_ft3 || 0).toFixed(2);
  const barcodeSvg = code128B(box.box_id);

  const fmtAddr = (a: any) => {
    if (!a) return "<p>N/A</p>";
    return `
      <p style="font-weight:600;margin:0">${a.name}</p>
      ${a.phone ? `<p style="margin:0;font-size:11px">${a.phone}</p>` : ""}
      <p style="margin:0;font-size:11px">${a.line1}</p>
      ${a.line2 ? `<p style="margin:0;font-size:11px">${a.line2}</p>` : ""}
      <p style="margin:0;font-size:11px">${a.city}${a.state ? ", " + a.state : ""} ${a.postal_code || ""}</p>
      <p style="margin:0;font-size:11px;font-weight:600">${a.country}</p>
    `;
  };

  return `
    <div style="width:4in;height:6in;border:1px solid #000;padding:12px;font-family:Arial,sans-serif;font-size:12px;box-sizing:border-box;page-break-after:always;display:flex;flex-direction:column;">
      <!-- Header -->
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px;">
        <div style="font-size:18px;font-weight:800;letter-spacing:1px">${company?.name || "Angel Shipping"}</div>
        ${company?.phone ? `<div style="font-size:10px">${company.phone}</div>` : ""}
      </div>

      <!-- IDs -->
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <div>
          <div style="font-size:9px;color:#666;text-transform:uppercase">Shipment</div>
          <div style="font-size:14px;font-weight:700;font-family:monospace">${shipment.shipment_id}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:9px;color:#666;text-transform:uppercase">Box</div>
          <div style="font-size:14px;font-weight:700;font-family:monospace">${box.box_id}</div>
        </div>
      </div>

      <!-- Service badge -->
      <div style="text-align:center;margin-bottom:8px;">
        <span style="background:${shipment.service_type === "AIR" ? "#3b82f6" : "#64748b"};color:#fff;padding:2px 12px;border-radius:4px;font-size:13px;font-weight:700;letter-spacing:1px">${shipment.service_type}</span>
      </div>

      <!-- Addresses -->
      <div style="display:flex;gap:8px;margin-bottom:8px;flex:1;">
        <div style="flex:1;border:1px solid #ccc;border-radius:4px;padding:6px;">
          <div style="font-size:9px;color:#666;text-transform:uppercase;margin-bottom:2px">From</div>
          ${fmtAddr(senderAddr)}
        </div>
        <div style="flex:1;border:1px solid #ccc;border-radius:4px;padding:6px;">
          <div style="font-size:9px;color:#666;text-transform:uppercase;margin-bottom:2px">To</div>
          ${fmtAddr(receiverAddr)}
        </div>
      </div>

      <!-- Dimensions -->
      <div style="border:1px solid #ccc;border-radius:4px;padding:6px;margin-bottom:8px;display:flex;justify-content:space-around;text-align:center;">
        <div>
          <div style="font-size:9px;color:#666">DIMENSIONS</div>
          <div style="font-weight:600">${parseFloat(box.length_in)}" × ${parseFloat(box.width_in)}" × ${parseFloat(box.height_in)}"</div>
        </div>
        <div>
          <div style="font-size:9px;color:#666">VOLUME</div>
          <div style="font-weight:700;font-size:14px">${vol} ft³</div>
        </div>
      </div>

      <!-- Barcode -->
      <div style="text-align:center;margin-top:auto;">
        ${barcodeSvg}
        <div style="font-family:monospace;font-size:11px;margin-top:2px;letter-spacing:1px">${box.box_id}</div>
      </div>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Authentication & Authorization ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("generate-label: Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth token to validate identity
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("generate-label: Invalid token", claimsError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log("generate-label: Authenticated user", userId);

    // Verify staff/admin role using the auth client (respects RLS)
    const { data: roleData, error: roleError } = await authClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError || !roleData || !["admin", "staff"].includes(roleData.role)) {
      console.error("generate-label: Insufficient permissions for user", userId, roleError?.message);
      return new Response(
        JSON.stringify({ error: "Forbidden: insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("generate-label: User authorized with role", roleData.role);

    // --- Use authenticated client for data queries (respects RLS) ---
    const { shipmentId, boxIds } = await req.json();

    if (!shipmentId || typeof shipmentId !== "string") {
      return new Response(
        JSON.stringify({ error: "shipmentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch shipment (RLS ensures only staff/admin can see)
    const { data: shipment, error: shipErr } = await authClient
      .from("shipments")
      .select("*")
      .eq("id", shipmentId)
      .single();
    if (shipErr) throw shipErr;

    // Fetch boxes
    let boxQuery = authClient.from("boxes").select("*").eq("shipment_id", shipmentId).order("created_at");
    if (boxIds && Array.isArray(boxIds) && boxIds.length > 0) {
      boxQuery = boxQuery.in("id", boxIds);
    }
    const { data: boxes, error: boxErr } = await boxQuery;
    if (boxErr) throw boxErr;

    // Fetch addresses
    const [senderRes, receiverRes] = await Promise.all([
      shipment.sender_address_id
        ? authClient.from("addresses").select("*").eq("id", shipment.sender_address_id).single()
        : { data: null },
      shipment.receiver_address_id
        ? authClient.from("addresses").select("*").eq("id", shipment.receiver_address_id).single()
        : { data: null },
    ]);

    // Fetch company settings
    const { data: company } = await authClient
      .from("company_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    // Build HTML for all labels
    const labelsHtml = (boxes || [])
      .map((box: any) =>
        buildLabelHtml(box, shipment, senderRes.data, receiverRes.data, company)
      )
      .join("");

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          @page { size: 4in 6in; margin: 0; }
          body { margin: 0; padding: 0; }
          @media print {
            div { page-break-after: always; }
            div:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>${labelsHtml}</body>
      </html>
    `;

    console.log("generate-label: Generated", boxes?.length || 0, "labels for shipment", shipmentId);

    return new Response(
      JSON.stringify({ html: fullHtml, count: boxes?.length || 0 }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("generate-label: Error", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to generate labels" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
