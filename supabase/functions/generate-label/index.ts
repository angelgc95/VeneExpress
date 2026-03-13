import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Code128 fallback barcode generator → SVG
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

const EAN13_LEFT_L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];

const EAN13_LEFT_G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];

const EAN13_RIGHT = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100",
];

const EAN13_PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
];

function getEan13CheckDigit(text: string): string | null {
  const digitsOnly = text.replace(/\D/g, "");
  if (!/^\d{12}$/.test(digitsOnly)) return null;

  const total = digitsOnly
    .split("")
    .map(Number)
    .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3), 0);

  return String((10 - (total % 10)) % 10);
}

function ean13(text: string): string {
  const digitsOnly = text.replace(/\D/g, "");
  const value = /^\d{13}$/.test(digitsOnly)
    ? digitsOnly
    : /^\d{12}$/.test(digitsOnly)
      ? `${digitsOnly}${getEan13CheckDigit(digitsOnly)}`
      : null;

  if (!value) {
    return code128(text);
  }

  const parity = EAN13_PARITY[Number(value[0])];
  const leftDigits = value.slice(1, 7);
  const rightDigits = value.slice(7);

  let bits = "101";
  for (let i = 0; i < leftDigits.length; i += 1) {
    const digit = Number(leftDigits[i]);
    bits += parity[i] === "L" ? EAN13_LEFT_L[digit] : EAN13_LEFT_G[digit];
  }

  bits += "01010";

  for (const digitChar of rightDigits) {
    bits += EAN13_RIGHT[Number(digitChar)];
  }

  bits += "101";

  const moduleWidth = 2;
  const quietZone = moduleWidth * 11;
  const barHeight = 76;
  const guardHeight = 92;
  const totalWidth = bits.length * moduleWidth + quietZone * 2;
  const totalHeight = guardHeight + 18;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" style="display:block;width:100%;height:auto;shape-rendering:crispEdges">`;
  svg += `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="#fff"/>`;

  for (let i = 0; i < bits.length; i += 1) {
    if (bits[i] !== "1") continue;
    const isGuardBar = i < 3 || (i >= 45 && i < 50) || i >= 92;
    svg += `<rect x="${quietZone + i * moduleWidth}" y="0" width="${moduleWidth}" height="${isGuardBar ? guardHeight : barHeight}" fill="#000"/>`;
  }

  svg += `<text x="${totalWidth / 2}" y="${totalHeight - 2}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" letter-spacing="1">${value}</text>`;
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

function getBoxBarcodeValueFromId(boxId: string): string | null {
  const scanCode = getBoxScanCodeFromId(boxId);
  if (!scanCode) return null;
  const checkDigit = getEan13CheckDigit(scanCode);
  if (!checkDigit) return null;
  return `${scanCode}${checkDigit}`;
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

function formatAddressBlock(address: any): string {
  if (!address) {
    return `<p class="address-line">No address set</p>`;
  }

  return [
    `<p class="address-name">${escapeHtml(address.name)}</p>`,
    address.phone ? `<p class="address-line">${escapeHtml(address.phone)}</p>` : "",
    `<p class="address-line">${escapeHtml(address.line1)}</p>`,
    address.line2 ? `<p class="address-line">${escapeHtml(address.line2)}</p>` : "",
    `<p class="address-line">${escapeHtml(address.city)}${address.state ? `, ${escapeHtml(address.state)}` : ""} ${escapeHtml(address.postal_code || "")}</p>`,
    `<p class="address-line">${escapeHtml(address.country)}</p>`,
  ].join("");
}

function formatMeasurement(value: unknown): string {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return "";
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(2);
}

function buildBarcodeLabel(box: any): string {
  const barcodeValue = getBoxBarcodeValueFromId(box.box_id) ?? getBoxScanCodeFromId(box.box_id) ?? box.box_id;
  const barcodeSvg = ean13(barcodeValue);

  return `
    <div class="label barcode-label">
      <div class="barcode-shell">
        <div class="barcode-stage">
          <div class="barcode-rotator">
            <div class="barcode-art">${barcodeSvg}</div>
          </div>
        </div>
        <div class="barcode-code">${escapeHtml(box.box_id)}</div>
      </div>
    </div>
  `;
}

function buildDetailLabel(box: any, shipment: any, senderAddr: any, receiverAddr: any): string {
  const dimensions = [box.length_in, box.width_in, box.height_in]
    .map(formatMeasurement)
    .filter(Boolean)
    .join(" x ");
  const footerSegments = [
    `<span>Box <strong>${escapeHtml(box.box_id)}</strong></span>`,
    dimensions ? `<span>${escapeHtml(dimensions)} in</span>` : "",
    box.notes ? `<span>${escapeHtml(box.notes)}</span>` : "",
  ].filter(Boolean);

  return `
    <div class="label detail-label">
      <div class="detail-card">
        <div class="detail-header">
          <div class="detail-header-copy">
            <div class="eyebrow">Shipment</div>
            <div class="shipment-number">${escapeHtml(shipment.shipment_id)}</div>
          </div>
          <div class="mode-badge ${shipment.service_type === "AIR" ? "air" : "sea"}">${escapeHtml(shipment.service_type)}</div>
        </div>

        <div class="address-grid">
          <div class="address-panel">
            <div class="address-label">From</div>
            ${formatAddressBlock(senderAddr)}
          </div>
          <div class="address-panel">
            <div class="address-label">To</div>
            ${formatAddressBlock(receiverAddr)}
          </div>
        </div>

        <div class="detail-footer">
          ${footerSegments.join("")}
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

    const labelsHtml = (boxes || [])
      .map((box: any) =>
        isBarcode
          ? buildBarcodeLabel(box)
          : buildDetailLabel(box, shipment, senderAddr, receiverAddr)
      )
      .join("");

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          @page { size: 4in 6in; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #fff; }
          body {
            margin: 0;
            padding: 0;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
          }
          .label {
            width: 4in;
            height: 6in;
            padding: 0.24in;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .label:last-child { page-break-after: auto; }
          .barcode-label {
            align-items: center;
            justify-content: center;
          }
          .barcode-shell {
            width: 100%;
            height: 100%;
            border: 2px solid #111827;
            border-radius: 18px;
            padding: 0.28in 0.24in 0.22in;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.16in;
          }
          .barcode-stage {
            position: relative;
            width: 100%;
            flex: 1;
            min-height: 0;
            overflow: hidden;
          }
          .barcode-rotator {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 4.85in;
            transform: translate(-50%, -50%) rotate(90deg);
            transform-origin: center;
          }
          .barcode-art {
            width: 100%;
            max-width: none;
          }
          .barcode-code {
            text-align: center;
            width: 100%;
            padding-top: 0.08in;
            border-top: 1px solid #d1d5db;
            font-size: 18px;
            font-weight: 800;
            letter-spacing: 1.2px;
            line-height: 1.15;
          }
          .detail-card {
            flex: 1;
            border: 2px solid #111827;
            border-radius: 20px;
            padding: 0.22in;
            display: flex;
            flex-direction: column;
            gap: 0.18in;
          }
          .detail-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }
          .detail-header-copy {
            min-width: 0;
          }
          .eyebrow {
            margin-bottom: 6px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.6px;
            text-transform: uppercase;
            color: #6b7280;
          }
          .shipment-number {
            font-size: 28px;
            font-weight: 800;
            line-height: 1.05;
            word-break: break-word;
          }
          .mode-badge {
            border-radius: 999px;
            padding: 6px 12px;
            color: #fff;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 1.4px;
          }
          .mode-badge.air { background: #2563eb; }
          .mode-badge.sea { background: #334155; }
          .address-grid {
            flex: 1;
            display: grid;
            gap: 0.14in;
          }
          .address-panel {
            min-height: 1.62in;
            border: 1px solid #d1d5db;
            border-radius: 16px;
            padding: 0.18in;
          }
          .address-label {
            margin-bottom: 10px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 1.4px;
            text-transform: uppercase;
            color: #6b7280;
          }
          .address-name {
            margin: 0 0 6px;
            font-size: 17px;
            font-weight: 700;
            line-height: 1.2;
          }
          .address-line {
            margin: 0 0 4px;
            font-size: 14px;
            line-height: 1.35;
          }
          .detail-footer {
            display: flex;
            flex-wrap: wrap;
            gap: 10px 16px;
            padding-top: 0.12in;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #4b5563;
          }
          .detail-footer strong {
            color: #111827;
          }
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
