import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildInvoiceHtml(
  invoice: any,
  lineItems: any[],
  payments: any[],
  shipment: any,
  customer: any,
  company: any
): string {
  const fmtMoney = (v: any) => `$${parseFloat(String(v || 0)).toFixed(2)}`;
  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const lineItemRows = lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${item.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${item.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${fmtMoney(item.unit_price)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:600;">${fmtMoney(item.line_total)}</td>
      </tr>`
    )
    .join("");

  const paymentRows = payments.length > 0
    ? payments
        .map(
          (p) => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;">${fmtDate(p.paid_at)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;text-transform:capitalize;">${p.method}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${p.reference || "—"}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;font-weight:600;">${fmtMoney(p.amount)}</td>
        </tr>`
        )
        .join("")
    : "";

  const paymentSection = payments.length > 0
    ? `
      <div style="margin-top:24px;">
        <h3 style="font-size:14px;font-weight:700;margin:0 0 8px 0;color:#374151;">Payment History</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:6px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Date</th>
              <th style="padding:6px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Method</th>
              <th style="padding:6px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Reference</th>
              <th style="padding:6px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Amount</th>
            </tr>
          </thead>
          <tbody>${paymentRows}</tbody>
        </table>
      </div>`
    : "";

  const adjustment = parseFloat(String(invoice.adjustment || 0));
  const adjustmentRow = adjustment !== 0
    ? `<tr>
        <td style="padding:4px 0;font-size:13px;color:#6b7280;">Adjustment</td>
        <td style="padding:4px 0;font-size:13px;text-align:right;">${adjustment > 0 ? "+" : ""}${fmtMoney(adjustment)}</td>
      </tr>`
    : "";

  const statusColor = invoice.payment_status === "Paid"
    ? "#16a34a"
    : invoice.payment_status === "Partial"
    ? "#d97706"
    : "#dc2626";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Invoice ${invoice.invoice_number}</title>
      <style>
        @page { size: letter; margin: 0.6in; }
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; }
        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { padding: 40px; background: #f3f4f6; }
          .invoice-container { background: white; max-width: 800px; margin: 0 auto; padding: 48px; box-shadow: 0 1px 3px rgba(0,0,0,0.12); border-radius: 8px; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
          <div>
            <h1 style="font-size:28px;font-weight:800;margin:0;letter-spacing:-0.5px;">${company?.name || "VeneExpress Shipping"}</h1>
            ${company?.phone ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${company.phone}</p>` : ""}
            ${company?.address ? `<p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${company.address}</p>` : ""}
          </div>
          <div style="text-align:right;">
            <h2 style="font-size:24px;font-weight:700;margin:0;color:#374151;">INVOICE</h2>
            <p style="margin:4px 0 0;font-size:15px;font-weight:600;font-family:monospace;">${invoice.invoice_number}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Date: ${fmtDate(invoice.created_at)}</p>
            ${invoice.is_finalized ? `<p style="margin:4px 0 0;font-size:11px;color:#6b7280;">Finalized: ${fmtDate(invoice.finalized_at)}</p>` : ""}
          </div>
        </div>

        <!-- Bill To & Shipment Info -->
        <div style="display:flex;gap:24px;margin-bottom:28px;">
          <div style="flex:1;background:#f9fafb;border-radius:6px;padding:14px;">
            <p style="font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;margin:0 0 4px;">Bill To</p>
            <p style="font-size:14px;font-weight:600;margin:0;">${customer?.first_name || ""} ${customer?.last_name || ""}</p>
            ${customer?.phone ? `<p style="font-size:12px;color:#6b7280;margin:2px 0 0;">${customer.phone}</p>` : ""}
            ${customer?.email ? `<p style="font-size:12px;color:#6b7280;margin:2px 0 0;">${customer.email}</p>` : ""}
          </div>
          <div style="flex:1;background:#f9fafb;border-radius:6px;padding:14px;">
            <p style="font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;margin:0 0 4px;">Shipment</p>
            <p style="font-size:14px;font-weight:600;margin:0;font-family:monospace;">${shipment.shipment_id}</p>
            <p style="font-size:12px;color:#6b7280;margin:2px 0 0;">Service: ${shipment.service_type}</p>
            <p style="font-size:12px;margin:2px 0 0;">
              Status: <span style="color:${statusColor};font-weight:600;">${invoice.payment_status}</span>
            </p>
          </div>
        </div>

        <!-- Line Items -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Description</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Qty</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Unit Price</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>${lineItemRows}</tbody>
        </table>

        <!-- Totals -->
        <div style="display:flex;justify-content:flex-end;">
          <table style="width:260px;border-collapse:collapse;">
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#6b7280;">Subtotal</td>
              <td style="padding:4px 0;font-size:13px;text-align:right;">${fmtMoney(invoice.subtotal)}</td>
            </tr>
            ${adjustmentRow}
            <tr style="border-top:2px solid #111827;">
              <td style="padding:8px 0 4px;font-size:15px;font-weight:700;">Total</td>
              <td style="padding:8px 0 4px;font-size:15px;font-weight:700;text-align:right;">${fmtMoney(invoice.total)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#16a34a;">Paid</td>
              <td style="padding:4px 0;font-size:13px;color:#16a34a;text-align:right;">${fmtMoney(invoice.paid_amount)}</td>
            </tr>
            <tr style="border-top:1px solid #e5e7eb;">
              <td style="padding:6px 0;font-size:14px;font-weight:700;">Balance Due</td>
              <td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right;color:${parseFloat(String(invoice.balance)) > 0 ? "#dc2626" : "#16a34a"};">${fmtMoney(invoice.balance)}</td>
            </tr>
          </table>
        </div>

        ${paymentSection}

        <!-- Footer -->
        <div style="margin-top:36px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="font-size:11px;color:#9ca3af;margin:0;">Thank you for your business!</p>
          <p style="font-size:11px;color:#9ca3af;margin:4px 0 0;">${company?.name || "VeneExpress Shipping"}${company?.phone ? " • " + company.phone : ""}</p>
        </div>
      </div>
    </body>
    </html>
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
      console.error("generate-invoice: Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("generate-invoice: Invalid token", claimsError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log("generate-invoice: Authenticated user", userId);

    // Verify staff/admin role
    const { data: roleData, error: roleError } = await authClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (roleError || !roleData || !["admin", "staff"].includes(roleData.role)) {
      console.error("generate-invoice: Insufficient permissions for user", userId);
      return new Response(
        JSON.stringify({ error: "Forbidden: insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("generate-invoice: User authorized with role", roleData.role);

    // --- Parse request ---
    const { shipmentId } = await req.json();
    if (!shipmentId || typeof shipmentId !== "string") {
      return new Response(
        JSON.stringify({ error: "shipmentId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Fetch data (RLS enforced via auth client) ---
    const [shipmentRes, invoiceRes, companyRes] = await Promise.all([
      authClient.from("shipments").select("*, customers(first_name, last_name, phone, email)").eq("id", shipmentId).single(),
      authClient.from("invoices").select("*").eq("shipment_id", shipmentId).maybeSingle(),
      authClient.from("company_settings").select("*").limit(1).maybeSingle(),
    ]);

    if (shipmentRes.error) throw shipmentRes.error;
    if (!invoiceRes.data) {
      return new Response(
        JSON.stringify({ error: "No invoice found for this shipment" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoice = invoiceRes.data;
    const shipment = shipmentRes.data;
    const customer = shipment.customers;
    const company = companyRes.data;

    // Fetch line items and payments in parallel
    const [lineItemsRes, paymentsRes] = await Promise.all([
      authClient.from("invoice_line_items").select("*").eq("invoice_id", invoice.id).order("type"),
      authClient.from("payments").select("*").eq("invoice_id", invoice.id).order("paid_at", { ascending: false }),
    ]);

    if (lineItemsRes.error) throw lineItemsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const html = buildInvoiceHtml(
      invoice,
      lineItemsRes.data || [],
      paymentsRes.data || [],
      shipment,
      customer,
      company
    );

    console.log("generate-invoice: Generated invoice", invoice.invoice_number, "for shipment", shipmentId);

    return new Response(
      JSON.stringify({ html, invoiceNumber: invoice.invoice_number }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("generate-invoice: Error", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to generate invoice" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
