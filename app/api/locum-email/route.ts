import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocumEmailBody = {
  to?: string;
  locumName?: string;
  subject?: string;
  message?: string;
  employerName?: string;
  employerEmail?: string;
};

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function messageToHtml(message: string) {
  return escapeHtml(message).replace(/\n/g, "<br />");
}

export async function POST(req: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "RESEND_API_KEY is not configured in Vercel.",
        },
        {
          status: 500,
        },
      );
    }

    const body = (await req.json()) as LocumEmailBody;

    const to = String(body.to || "").trim();
    const locumName = String(
      body.locumName || "Healthcare Professional",
    ).trim();

    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    const employerName = String(
      body.employerName || "CareStaffing Employer",
    ).trim();

    const employerEmail = String(
      body.employerEmail || "",
    ).trim();

    if (!to || !validEmail(to)) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid locum email address is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!subject) {
      return NextResponse.json(
        {
          success: false,
          error: "Email subject is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Email message is required.",
        },
        {
          status: 400,
        },
      );
    }

    const safeLocumName = escapeHtml(locumName);
    const safeEmployerName = escapeHtml(employerName);
    const safeMessage = messageToHtml(message);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />

          <title>${escapeHtml(subject)}</title>
        </head>

        <body
          style="
            margin:0;
            padding:0;
            background:#f4f7f5;
            font-family:Arial,Helvetica,sans-serif;
            color:#1f2d26;
          "
        >
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="background:#f4f7f5;padding:30px 15px;"
          >
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  border="0"
                  style="
                    max-width:650px;
                    background:#ffffff;
                    border-radius:14px;
                    overflow:hidden;
                    border:1px solid #e2e8e4;
                  "
                >
                  <tr>
                    <td
                      style="
                        background:#087153;
                        padding:24px 30px;
                      "
                    >
                      <div
                        style="
                          color:#ffffff;
                          font-size:25px;
                          font-weight:700;
                        "
                      >
                        CareStaffing
                      </div>

                      <div
                        style="
                          margin-top:5px;
                          color:#dff2ea;
                          font-size:13px;
                        "
                      >
                        Healthcare Staffing Network
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:32px 30px;">
                      <p
                        style="
                          margin:0 0 20px;
                          font-size:16px;
                          line-height:1.6;
                        "
                      >
                        Dear ${safeLocumName},
                      </p>

                      <div
                        style="
                          font-size:15px;
                          line-height:1.7;
                          color:#27372f;
                        "
                      >
                        ${safeMessage}
                      </div>

                      <div
                        style="
                          margin-top:30px;
                          padding:18px;
                          background:#f5f9f7;
                          border-left:4px solid #087153;
                          border-radius:6px;
                        "
                      >
                        <strong>Contacting employer</strong>

                        <br />

                        ${safeEmployerName}

                        ${
                          employerEmail &&
                          validEmail(employerEmail)
                            ? `
                              <br />
                              <a
                                href="mailto:${escapeHtml(
                                  employerEmail,
                                )}"
                                style="color:#087153;"
                              >
                                ${escapeHtml(employerEmail)}
                              </a>
                            `
                            : ""
                        }
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        padding:20px 30px;
                        background:#f5f8f6;
                        color:#738078;
                        font-size:12px;
                        line-height:1.5;
                      "
                    >
                      This message was sent via the CareStaffing
                      healthcare professional directory.

                      <br /><br />

                      CareStaffing
                      <br />
                      care-staffing.com
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const resendBody: Record<string, unknown> = {
      from:
        process.env.CARESTAFF_FROM_EMAIL ||
        "CareStaffing <info@care-staffing.com>",

      to: [to],

      subject,

      html,

      text: message,
    };

    /*
     * When the locum presses Reply in Gmail/Outlook,
     * the response goes directly to the employer.
     */
    if (employerEmail && validEmail(employerEmail)) {
      resendBody.reply_to = employerEmail;
    }

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify(resendBody),
      },
    );

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);

      return NextResponse.json(
        {
          success: false,
          error:
            resendData?.message ||
            "CareStaffing could not send the email.",
        },
        {
          status: resendResponse.status,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email sent successfully.",
      emailId: resendData?.id || null,
    });
  } catch (error: any) {
    console.error("Locum email API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "An unexpected error occurred while sending the email.",
      },
      {
        status: 500,
      },
    );
  }
}
