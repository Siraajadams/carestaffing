import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { shiftId } = await req.json();

    if (!shiftId) {
      return NextResponse.json(
        { error: "shiftId is required" },
        { status: 400 }
      );
    }

    // Load shift
    const { data: shift, error: shiftError } = await supabaseAdmin
      .from("shifts")
      .select("*")
      .eq("id", shiftId)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    const profession = shift.profession_required;

    if (!profession) {
      return NextResponse.json(
        { error: "Shift has no profession assigned" },
        { status: 400 }
      );
    }

    // Find matching locums
    const { data: locums, error: locumError } = await supabaseAdmin
      .from("profiles")
      .select("id,first_name,surname,email,profession")
      .eq("profession", profession)
      .not("email", "is", null);

    if (locumError) {
      throw locumError;
    }

    if (!locums || locums.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: `No ${profession} locums found`,
      });
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://www.care-staffing.com";

    let sent = 0;
    let failed = 0;

    for (const locum of locums) {
      try {
        await resend.emails.send({
          from: "CareStaffing <info@care-staffing.com>",
          to: locum.email,
          subject: `New ${profession} Locum Shift Available`,
          html: `
            <div style="
              max-width:620px;
              margin:auto;
              font-family:Arial,sans-serif;
              color:#17252b;
            ">

              <div style="
                background:linear-gradient(135deg,#102a43,#087f73);
                padding:32px;
                border-radius:18px 18px 0 0;
                color:white;
              ">
                <div style="
                  font-size:14px;
                  letter-spacing:2px;
                  font-weight:700;
                  color:#9ff5df;
                ">
                  CARESTAFFING
                </div>

                <h1 style="margin-bottom:6px;">
                  New ${profession} Shift
                </h1>

                <p style="margin:0;">
                  A new locum opportunity is available.
                </p>
              </div>

              <div style="
                padding:30px;
                border:1px solid #e4e8eb;
                border-top:none;
                border-radius:0 0 18px 18px;
              ">

                <p>
                  Hi ${locum.first_name || "Healthcare Professional"},
                </p>

                <p>
                  A new <strong>${profession}</strong> locum shift
                  matching your CareStaffing profile has been posted.
                </p>

                <table style="
                  width:100%;
                  border-collapse:collapse;
                  margin:22px 0;
                ">
                  <tr>
                    <td style="padding:9px 0;"><strong>Shift</strong></td>
                    <td>${shift.title || "Locum Shift"}</td>
                  </tr>

                  <tr>
                    <td style="padding:9px 0;"><strong>Profession</strong></td>
                    <td>${profession}</td>
                  </tr>

                  <tr>
                    <td style="padding:9px 0;"><strong>Employer</strong></td>
                    <td>${shift.business_name || "CareStaffing Employer"}</td>
                  </tr>

                  <tr>
                    <td style="padding:9px 0;"><strong>Location</strong></td>
                    <td>${shift.city || ""} ${shift.location || ""}</td>
                  </tr>

                  <tr>
                    <td style="padding:9px 0;"><strong>Date</strong></td>
                    <td>${shift.shift_date || shift.start_date || ""}</td>
                  </tr>

                  <tr>
                    <td style="padding:9px 0;"><strong>Time</strong></td>
                    <td>
                      ${shift.start_time || ""}
                      ${shift.end_time ? ` – ${shift.end_time}` : ""}
                    </td>
                  </tr>

                  ${
                    shift.hourly_rate
                      ? `
                      <tr>
                        <td style="padding:9px 0;"><strong>Rate</strong></td>
                        <td>R${shift.hourly_rate}/hour</td>
                      </tr>
                      `
                      : ""
                  }
                </table>

                <div style="text-align:center;margin:32px 0;">
                  <a
                    href="${siteUrl}/shifts"
                    style="
                      display:inline-block;
                      background:#13c8a3;
                      color:#062c2a;
                      font-weight:700;
                      padding:15px 28px;
                      border-radius:10px;
                      text-decoration:none;
                    "
                  >
                    VIEW & APPLY FOR SHIFT
                  </a>
                </div>

                <p style="
                  color:#6b7280;
                  font-size:13px;
                  margin-top:30px;
                ">
                  You are receiving this message because you are
                  registered on CareStaffing as a ${profession}.
                </p>
              </div>
            </div>
          `,
        });

        sent++;
      } catch (emailError) {
        console.error(
          `Could not email ${locum.email}`,
          emailError
        );
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      profession,
      matched: locums.length,
      sent,
      failed,
    });
  } catch (error: any) {
    console.error("notify-locums error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Unable to notify locums",
      },
      { status: 500 }
    );
  }
}
