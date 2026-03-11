import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Code128 barcode generator → SVG
// Numeric payloads use Code128-C for denser, more reliable labels.
function code128(text: string): string {
  const START_B = 104;
  const START_C = 105;
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

  const numericOnly = /^\d+$/.test(text) && text.length > 0 && text.length % 2 === 0;
  const indices = [numericOnly ? START_C : START_B];
  let checksum = indices[0];

  if (numericOnly) {
    for (let i = 0; i < text.length; i += 2) {
      const value = Number(text.slice(i, i + 2));
      indices.push(value);
      checksum += value * (i / 2 + 1);
    }
  } else {
    for (let i = 0; i < text.length; i++) {
      const idx = text.charCodeAt(i) - 32;
      indices.push(idx);
      checksum += idx * (i + 1);
    }
  }

  indices.push(checksum % 103);
  indices.push(STOP);

  let bits = "";
  for (const idx of indices) bits += patterns[idx];

  // Standard module width for reliable scanning
  const moduleWidth = 2;
  const height = 80;
  // Quiet zone: minimum 10x module width per Code 128 spec
  const quietZone = moduleWidth * 10;
  const barcodeWidth = bits.length * moduleWidth;
  const totalWidth = barcodeWidth + quietZone * 2;
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">`;
  // White background for clean scanning
  svg += `<rect x="0" y="0" width="${totalWidth}" height="${height}" fill="#fff"/>`;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") {
      svg += `<rect x="${quietZone + i * moduleWidth}" y="0" width="${moduleWidth}" height="${height}" fill="#000"/>`;
    }
  }
  svg += `</svg>`;
  return svg;
}

function getShipmentScanCodeFromId(shipmentId: string): string | null {
  const match = shipmentId.trim().toUpperCase().match(/^VE-(\d{4})-(\d{6})$/);
  if (!match) return null;
  const [, year, sequence] = match;
  return `${year}${sequence}`;
}

function getBoxScanCodeFromId(boxId: string): string | null {
  const match = boxId.trim().toUpperCase().match(/^(VE-\d{4}-\d{6})-(\d{2})$/);
  if (!match) return null;
  const [, shipmentId, boxNumber] = match;
  const shipmentScanCode = getShipmentScanCodeFromId(shipmentId);
  if (!shipmentScanCode) return null;
  return `${shipmentScanCode}${boxNumber}`;
}

function escapeHtml(unsafe: any): string {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildBarcodeLabel(box: any, _shipment: any): string {
  const scanCode = getBoxScanCodeFromId(box.box_id) ?? box.box_id;
  const barcodeSvg = code128(scanCode);
  return `
    <div class="label barcode-label">
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
        ${barcodeSvg}
        <div style="font-size:8px;color:#666;text-transform:uppercase;letter-spacing:1px">Manual code</div>
        <div style="font-family:'Courier New',monospace;font-size:12px;letter-spacing:2px;font-weight:700">${escapeHtml(scanCode)}</div>
        <div style="font-family:'Courier New',monospace;font-size:9px;color:#555;font-weight:700">${escapeHtml(box.box_id)}</div>
      </div>
    </div>
  `;
}

function buildDetailLabel(box: any, shipment: any, senderAddr: any, receiverAddr: any): string {
  const vol = parseFloat(box.volume_ft3 || 0).toFixed(2);
  const scanCode = getBoxScanCodeFromId(box.box_id) ?? box.box_id;
  const barcodeSvg = code128(scanCode);

  const fmtAddr = (a: any) => {
    if (!a) return "<p style='margin:0;font-size:8px'>N/A</p>";
    return `
      <p style="font-weight:600;margin:0;font-size:9px">${escapeHtml(a.name)}</p>
      ${a.phone ? `<p style="margin:0;font-size:8px">${escapeHtml(a.phone)}</p>` : ""}
      <p style="margin:0;font-size:8px">${escapeHtml(a.line1)}</p>
      ${a.line2 ? `<p style="margin:0;font-size:8px">${escapeHtml(a.line2)}</p>` : ""}
      <p style="margin:0;font-size:8px">${escapeHtml(a.city)}${a.state ? ", " + escapeHtml(a.state) : ""} ${escapeHtml(a.postal_code || "")}</p>
      <p style="margin:0;font-size:8px;font-weight:600">${escapeHtml(a.country)}</p>
    `;
  };

  return `
    <div class="label detail-label">
      <!-- Barcode at top -->
      <div style="text-align:center;margin-bottom:3px;">
        ${barcodeSvg}
        <div style="font-size:7px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:2px">Manual code</div>
        <div style="font-family:'Courier New',monospace;font-size:9px;letter-spacing:1px;font-weight:700">${escapeHtml(scanCode)}</div>
        <div style="font-family:'Courier New',monospace;font-size:8px;letter-spacing:0.8px;font-weight:700;color:#555">${escapeHtml(box.box_id)}</div>
      </div>

      <!-- IDs -->
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
        <div>
          <div style="font-size:7px;color:#666;text-transform:uppercase">Shipment</div>
          <div style="font-size:10px;font-weight:700;font-family:monospace">${escapeHtml(shipment.shipment_id)}</div>
        </div>
        <div style="text-align:right">
          <span style="background:${shipment.service_type === "AIR" ? "#3b82f6" : "#64748b"};color:#fff;padding:1px 8px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:1px">${shipment.service_type}</span>
        </div>
      </div>

      <!-- Addresses -->
      <div style="display:flex;gap:4px;margin-bottom:3px;flex:1;">
        <div style="flex:1;border:1px solid #ccc;border-radius:2px;padding:3px;">
          <div style="font-size:7px;color:#666;text-transform:uppercase;margin-bottom:1px">From</div>
          ${fmtAddr(senderAddr)}
        </div>
        <div style="flex:1;border:1px solid #ccc;border-radius:2px;padding:3px;">
          <div style="font-size:7px;color:#666;text-transform:uppercase;margin-bottom:1px">To</div>
          ${fmtAddr(receiverAddr)}
        </div>
      </div>

      <!-- Dimensions -->
      <div style="border:1px solid #ccc;border-radius:2px;padding:3px;display:flex;justify-content:space-around;text-align:center;">
        <div>
          <div style="font-size:7px;color:#666">DIMENSIONS</div>
          <div style="font-weight:600;font-size:9px">${parseFloat(box.length_in)}" × ${parseFloat(box.width_in)}" × ${parseFloat(box.height_in)}"</div>
        </div>
        <div>
          <div style="font-size:7px;color:#666">VOLUME</div>
          <div style="font-weight:700;font-size:10px">${vol} ft³</div>
        </div>
      </div>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claimsData.claims.sub;
    const { data: roleData, error: roleError } = await authClient
      .from("user_roles").select("role").eq("user_id", userId).maybeSingle();

    if (roleError || !roleData || !["admin", "staff"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const { shipmentId, boxIds, labelType = "detail" } = await req.json();

    if (!shipmentId || typeof shipmentId !== "string" || !UUID_REGEX.test(shipmentId)) {
      return new Response(JSON.stringify({ error: "Invalid shipmentId format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!["barcode", "detail"].includes(labelType)) {
      return new Response(JSON.stringify({ error: "Invalid labelType. Must be 'barcode' or 'detail'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (boxIds !== undefined && boxIds !== null) {
      if (!Array.isArray(boxIds) || boxIds.length > 100) {
        return new Response(JSON.stringify({ error: "Invalid boxIds parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!boxIds.every((id: unknown) => typeof id === "string" && UUID_REGEX.test(id as string))) {
        return new Response(JSON.stringify({ error: "Invalid boxId format in array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: shipment, error: shipErr } = await authClient
      .from("shipments").select("*").eq("id", shipmentId).single();
    if (shipErr) throw shipErr;

    let boxQuery = authClient.from("boxes").select("*").eq("shipment_id", shipmentId).order("created_at");
    if (boxIds && Array.isArray(boxIds) && boxIds.length > 0) {
      boxQuery = boxQuery.in("id", boxIds);
    }
    const { data: boxes, error: boxErr } = await boxQuery;
    if (boxErr) throw boxErr;

    let senderAddr = null;
    let receiverAddr = null;

    if (labelType === "detail") {
      const [senderRes, receiverRes] = await Promise.all([
        shipment.sender_address_id
          ? authClient.from("addresses").select("*").eq("id", shipment.sender_address_id).single()
          : { data: null },
        shipment.receiver_address_id
          ? authClient.from("addresses").select("*").eq("id", shipment.receiver_address_id).single()
          : { data: null },
      ]);
      senderAddr = senderRes.data;
      receiverAddr = receiverRes.data;
    }

    const isBarcode = labelType === "barcode";
    const labelHeight = isBarcode ? "30mm" : "55mm";

    const labelsHtml = (boxes || [])
      .map((box: any) =>
        isBarcode
          ? buildBarcodeLabel(box, shipment)
          : buildDetailLabel(box, shipment, senderAddr, receiverAddr)
      )
      .join("");

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          @page { size: 62mm ${labelHeight}; margin: 0; }
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; }
          .label {
            width: 62mm;
            height: ${labelHeight};
            padding: 4px 6px;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9px;
            box-sizing: border-box;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .label:last-child { page-break-after: auto; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .label { page-break-after: always; }
            .label:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>${labelsHtml}</body>
      </html>
    `;

    console.log("generate-label:", labelType, "- Generated", boxes?.length || 0, "labels for shipment", shipmentId);

    return new Response(
      JSON.stringify({ html: fullHtml, count: boxes?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("generate-label: Error", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to generate labels" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
