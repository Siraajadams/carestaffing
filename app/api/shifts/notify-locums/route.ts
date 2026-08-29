import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getMatchingProfessions(profession: string): string[] {
  const clean = profession.trim().toLowerCase();

  // General pharmacist shifts may be sent to all pharmacist categories.
  if (clean === "pharmacist") {
    return [
      "Pharmacist",
      "Pharmacist PIMART Permit",
      "Pharmacist PCDT Permit",
      "Pharmacist PCDT and PIMART Permit",
      "Pharmacist PCDT & PIMART Permit",
    ];
  }

  // Combined PCDT + PIMART shifts should only go to combined-qualified pharmacists.
  if (clean.includes("pimart") && clean.includes("pcdt")) {
    return [
      "Pharmacist PCDT and PIMART Permit",
      "Pharmacist PCDT & PIMART Permit",
    ];
  }

  // PIMART shifts can go to PIMART-only or combined-qualified pharmacists.
  if (clean.includes("pimart")) {
    return [
      "Pharmacist PIMART Permit",
      "Pharmacist PCDT and PIMART Permit",
      "Pharmacist PCDT & PIMART Permit",
    ];
  }

  // PCDT shifts can go to PCDT-only or combined-qualified pharmacists.
  if (clean.includes("pcdt")) {
    return [
      "Pharmacist PCDT Permit",
      "Pharmacist PCDT and PIMART Permit",
      "Pharmacist PCDT & PIMART Permit",
    ];
  }

  // Doctor -> Doctor, Nurse -> Nurse, etc.
  return [profession];
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return "";

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return `R${escapeHtml(value)}`;
  }

  return `R${numberValue.toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

async function sendEmail({
  apiKey,
  to,
  subject,
  html,
}: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CareStaffing <info@care-staffing.com>",
      to: [to], // ONE recipient only - no CC and no BCC
      subject,
      html,
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.error ||
        `Resend returned HTTP ${response.status}`
    );
  }

  return result;
}

/* =========================================================
   POST
   Used for:
   1. Automatic notification after employer posts a shift.
   2. Admin "Still Available" -> Send Again.
========================================================= */

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const adminEmail =
      process.env.CARESTAFFING_ADMIN_EMAIL || "info@care-staffing.com";

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "NEXT_PUBLIC_SUPABASE_URL is not configured.",
        },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          error: "SUPABASE_SERVICE_ROLE_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    if (!resendApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "RESEND_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let body: {
      shiftId?: string;
      source?: "automatic" | "admin-resend";
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const shiftId = body.shiftId?.trim();
    const source = body.source || "automatic";

    if (!shiftId) {
      return NextResponse.json(
        {
          success: false,
          error: "shiftId is required.",
        },
        { status: 400 }
      );
    }

    const { data: shift, error: shiftError } = await supabaseAdmin
      .from("shifts")
      .select("*")
      .eq("id", shiftId)
      .single();

    if (shiftError) {
      console.error("Error loading shift:", shiftError);

      return NextResponse.json(
        {
          success: false,
          error: shiftError.message,
        },
        { status: 500 }
      );
    }

    if (!shift) {
      return NextResponse.json(
        {
          success: false,
          error: "Shift not found.",
        },
        { status: 404 }
      );
    }

    const profession = String(shift.profession_required || "").trim();

    if (!profession) {
      return NextResponse.json(
        {
          success: false,
          error: "This shift does not have a profession_required value.",
        },
        { status: 400 }
      );
    }

    const matchingProfessions = getMatchingProfessions(profession);

    const { data: locums, error: locumError } = await supabaseAdmin
      .from("profiles")
      .select("id,first_name,surname,email,profession")
      .in("profession", matchingProfessions)
      .not("email", "is", null);

    if (locumError) {
      console.error("Locum query error:", locumError);

      return NextResponse.json(
        {
          success: false,
          error: locumError.message,
        },
        { status: 500 }
      );
    }

    const uniqueLocums = Array.from(
      new Map(
        (locums || [])
          .filter(
            (locum) =>
              typeof locum.email === "string" &&
              locum.email.trim().length > 0
          )
          .map((locum) => [
            locum.email.trim().toLowerCase(),
            {
              ...locum,
              email: locum.email.trim().toLowerCase(),
            },
          ])
      ).values()
    );

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL || "https://www.care-staffing.com"
    ).replace(/\/$/, "");

    const shiftTitle =
      shift.title ||
      shift.shift_title ||
      `${profession} Locum Shift`;

    const employer =
      shift.business_name ||
      shift.company_name ||
      shift.employer_name ||
      "CareStaffing Employer";

    const city = shift.city || "";

    const location =
      shift.location ||
      shift.address ||
      "";

    const shiftDate =
      shift.shift_date ||
      shift.start_date ||
      shift.date ||
      "";

    const startTime = shift.start_time || "";
    const endTime = shift.end_time || "";

    const hourlyRate =
      shift.hourly_rate ??
      shift.rate ??
      null;

    const applyUrl = `${siteUrl}/shifts`;

    /* =====================================================
       ADMIN NOTIFICATION
       Sends ONE email to info@care-staffing.com.
       This is separate from locum notifications.
    ===================================================== */

    let adminNotified = false;
    let adminNotificationError: string | null = null;

    try {
      await sendEmail({
        apiKey: resendApiKey,
        to: adminEmail,
        subject:
          source === "admin-resend"
            ? `CareStaffing: ${profession} shift email re-sent`
            : `New CareStaffing ${profession} shift posted`,
        html: `
          <!DOCTYPE html>
          <html>
            <body style="margin:0;padding:24px;background:#f5f7f8;font-family:Arial,Helvetica,sans-serif;color:#17252b;">
              <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;">
                <div style="background:#073f3b;color:#ffffff;padding:26px 30px;">
                  <div style="font-size:13px;letter-spacing:2px;font-weight:700;color:#9ff5df;">
                    CARESTAFFING ADMIN
                  </div>
                  <h2 style="margin:10px 0 0;">
                    ${
                      source === "admin-resend"
                        ? "Available shift email re-sent"
                        : "New employer shift posted"
                    }
                  </h2>
                </div>

                <div style="padding:28px 30px;">
                  <p><strong>Shift:</strong> ${escapeHtml(shiftTitle)}</p>
                  <p><strong>Profession:</strong> ${escapeHtml(profession)}</p>
                  <p><strong>Employer:</strong> ${escapeHtml(employer)}</p>
                  ${
                    city || location
                      ? `<p><strong>Location:</strong> ${escapeHtml(
                          [city, location].filter(Boolean).join(", ")
                        )}</p>`
                      : ""
                  }
                  ${
                    shiftDate
                      ? `<p><strong>Date:</strong> ${escapeHtml(shiftDate)}</p>`
                      : ""
                  }
                  ${
                    startTime || endTime
                      ? `<p><strong>Time:</strong> ${escapeHtml(startTime)}${
                          endTime ? ` – ${escapeHtml(endTime)}` : ""
                        }</p>`
                      : ""
                  }
                  ${
                    hourlyRate !== null &&
                    hourlyRate !== undefined &&
                    hourlyRate !== ""
                      ? `<p><strong>Rate:</strong> ${formatMoney(
                          hourlyRate
                        )}/hour</p>`
                      : ""
                  }

                  <p>
                    <strong>Matching registered locums:</strong>
                    ${uniqueLocums.length}
                  </p>

                  <p style="margin-top:24px;color:#667085;font-size:13px;">
                    Source: ${
                      source === "admin-resend"
                        ? "Admin Still Available resend"
                        : "Automatic employer shift notification"
                    }
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      adminNotified = true;
    } catch (error) {
      adminNotificationError =
        error instanceof Error ? error.message : "Admin email failed";

      console.error("Admin notification failed:", error);
    }

    /* =====================================================
       SEND TO MATCHING LOCUMS - INDIVIDUALLY
    ===================================================== */

    if (uniqueLocums.length === 0) {
      return NextResponse.json({
        success: true,
        shiftId,
        profession,
        matchingProfessions,
        matched: 0,
        sent: 0,
        failed: 0,
        adminNotified,
        adminNotificationError,
        message: `No registered ${profession} locums with email addresses were found.`,
      });
    }

    let sent = 0;
    let failed = 0;

    const failures: {
      email: string;
      error: string;
    }[] = [];

    for (const locum of uniqueLocums) {
      const recipientEmail = locum.email;
      const firstName = locum.first_name || "Healthcare Professional";

      try {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
              <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
              />
            </head>

            <body
              style="
                margin:0;
                padding:20px;
                background:#f5f7f8;
                font-family:Arial,Helvetica,sans-serif;
              "
            >
              <div
                style="
                  max-width:620px;
                  margin:0 auto;
                  background:#ffffff;
                  border-radius:18px;
                  overflow:hidden;
                "
              >
                <div
                  style="
                    background:#073f3b;
                    padding:34px 30px;
                    color:#ffffff;
                  "
                >
                  <div
                    style="
                      font-size:14px;
                      letter-spacing:2px;
                      font-weight:700;
                      color:#9ff5df;
                      margin-bottom:12px;
                    "
                  >
                    CARESTAFFING
                  </div>

                  <h1
                    style="
                      margin:0 0 8px 0;
                      font-size:30px;
                      line-height:1.2;
                    "
                  >
                    New ${escapeHtml(profession)} Shift
                  </h1>

                  <p
                    style="
                      margin:0;
                      font-size:16px;
                      color:#e4f7f3;
                    "
                  >
                    A new locum opportunity is available.
                  </p>
                </div>

                <div
                  style="
                    padding:32px 30px;
                    color:#17252b;
                  "
                >
                  <p
                    style="
                      font-size:16px;
                      line-height:1.6;
                    "
                  >
                    Hi <strong>${escapeHtml(firstName)}</strong>,
                  </p>

                  <p
                    style="
                      font-size:16px;
                      line-height:1.6;
                    "
                  >
                    A new
                    <strong>${escapeHtml(profession)}</strong>
                    locum shift matching your CareStaffing profile is available.
                  </p>

                  <div
                    style="
                      margin:25px 0;
                      padding:22px;
                      background:#f7fbfa;
                      border:1px solid #d8ebe7;
                      border-radius:12px;
                    "
                  >
                    <table
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      style="
                        border-collapse:collapse;
                        font-size:15px;
                      "
                    >
                      <tr>
                        <td
                          style="
                            padding:9px 10px 9px 0;
                            font-weight:bold;
                            width:130px;
                          "
                        >
                          Shift
                        </td>

                        <td style="padding:9px 0;">
                          ${escapeHtml(shiftTitle)}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            padding:9px 10px 9px 0;
                            font-weight:bold;
                          "
                        >
                          Profession
                        </td>

                        <td style="padding:9px 0;">
                          ${escapeHtml(profession)}
                        </td>
                      </tr>

                      <tr>
                        <td
                          style="
                            padding:9px 10px 9px 0;
                            font-weight:bold;
                          "
                        >
                          Employer
                        </td>

                        <td style="padding:9px 0;">
                          ${escapeHtml(employer)}
                        </td>
                      </tr>

                      ${
                        city || location
                          ? `
                      <tr>
                        <td
                          style="
                            padding:9px 10px 9px 0;
                            font-weight:bold;
                          "
                        >
                          Location
                        </td>

                        <td style="padding:9px 0;">
                          ${escapeHtml(
                            [city, location].filter(Boolean).join(", ")
                          )}
                        </td>
                      </tr>
                      `
                          : ""
                      }

                      ${
                        shiftDate
                          ? `
                      <tr>
                        <td
                          style="
                            padding:9px 10px 9px 0;
                            font-weight:bold;
                          "
                        >
                          Date
                        </td>

                        <td style="padding:9px 0;">
                          ${escapeHtml(shiftDate)}
                        </td>
                      </tr>
                      `
                          : ""
                      }

                      ${
                        startTime || endTime
                          ? `
                      <tr>
                        <td
                          style="
                            padding:9px 10px 9px 0;
                            font-weight:bold;
                          "
                        >
                          Time
                        </td>

                        <td style="padding:9px 0;">
                          ${escapeHtml(startTime)}
                          ${endTime ? ` – ${escapeHtml(endTime)}` : ""}
                        </td>
                      </tr>
                      `
                          : ""
                      }

                      ${
                        hourlyRate !== null &&
                        hourlyRate !== undefined &&
                        hourlyRate !== ""
                          ? `
                      <tr>
                        <td
                          style="
                            padding:9px 10px 9px 0;
                            font-weight:bold;
                          "
                        >
                          Rate
                        </td>

                        <td style="padding:9px 0;">
                          ${formatMoney(hourlyRate)}/hour
                        </td>
                      </tr>
                      `
                          : ""
                      }
                    </table>
                  </div>

                  <div
                    style="
                      text-align:center;
                      margin:32px 0;
                    "
                  >
                    <a
                      href="${applyUrl}"
                      style="
                        display:inline-block;
                        background:#13c8a3;
                        color:#052f2b;
                        font-weight:700;
                        font-size:15px;
                        padding:16px 30px;
                        border-radius:10px;
                        text-decoration:none;
                      "
                    >
                      VIEW &amp; APPLY FOR SHIFT
                    </a>
                  </div>

                  <p
                    style="
                      color:#667085;
                      font-size:13px;
                      line-height:1.6;
                      margin-top:30px;
                    "
                  >
                    You are receiving this email because your CareStaffing
                    profile matches this locum opportunity.
                  </p>
                </div>

                <div
                  style="
                    padding:20px 30px;
                    background:#f2f6f5;
                    text-align:center;
                    color:#667085;
                    font-size:12px;
                  "
                >
                  CareStaffing
                  <br />
                  Healthcare staffing made simpler.
                </div>
              </div>
            </body>
          </html>
        `;

        await sendEmail({
          apiKey: resendApiKey,
          to: recipientEmail,
          subject: `New ${profession} Locum Shift Available`,
          html,
        });

        sent++;

        console.log(
          `Shift ${shiftId}: email sent individually to ${recipientEmail}`
        );
      } catch (emailError) {
        failed++;

        const message =
          emailError instanceof Error
            ? emailError.message
            : "Unknown email error";

        failures.push({
          email: recipientEmail,
          error: message,
        });

        console.error(
          `Could not email ${recipientEmail}:`,
          emailError
        );
      }
    }

    return NextResponse.json({
      success: true,
      shiftId,
      source,
      profession,
      matchingProfessions,
      matched: uniqueLocums.length,
      sent,
      failed,
      adminNotified,
      adminNotificationError,
      failures:
        process.env.NODE_ENV === "development"
          ? failures
          : undefined,
      message:
        failed === 0
          ? `${sent} ${profession} locum email${
              sent === 1 ? "" : "s"
            } sent individually.`
          : `${sent} emails sent individually. ${failed} failed.`,
    });
  } catch (error: unknown) {
    console.error("notify-locums fatal error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to notify locums.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}
