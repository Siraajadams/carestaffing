"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Shift = {
  id?: string;
  title?: string | null;
  location?: string | null;
  city?: string | null;
  business_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

type Timesheet = {
  id: string;
  shift_id?: string | null;
  locum_id?: string | null;

  work_date: string | null;

  start_time?: string | null;
  end_time?: string | null;
  break_minutes?: number | null;

  agreed_rate?: number | null;
  hours_worked?: number | null;
  days_worked?: number | null;
  total_amount?: number | null;

  status?: string | null;
  created_at?: string | null;
  approved_at?: string | null;

  shifts?: Shift | Shift[] | null;
};

type Profile = {
  id?: string;

  first_name?: string | null;
  surname?: string | null;
  email?: string | null;
  mobile?: string | null;

  id_number?: string | null;
  profession?: string | null;

  registration_number?: string | null;
  practice_number?: string | null;

  address?: string | null;
  city?: string | null;
  country?: string | null;

  bank_name?: string | null;
  account_holder_name?: string | null;
  account_number?: string | null;
  branch_code?: string | null;
};

export default function InvoicesPage() {
  const router = useRouter();

  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedInvoice, setSelectedInvoice] =
    useState<Timesheet | null>(null);

  useEffect(() => {
    void loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      /*
       * Using select("*") deliberately prevents the page from breaking
       * whenever you add new profile columns.
       */
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile loading error:", profileError);
      }

      setProfile((profileData as Profile | null) || null);

      /*
       * Your existing relationship already uses:
       * timesheets -> shifts
       *
       * Using shifts(*) allows the invoice to display available
       * employer / shift data without tightly coupling the page
       * to one shift schema version.
       */
      const {
        data: timesheetData,
        error: timesheetError,
      } = await supabase
        .from("timesheets")
        .select("*,shifts(*)")
        .eq("locum_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (timesheetError) {
        throw timesheetError;
      }

      setTimesheets((timesheetData as Timesheet[]) || []);
    } catch (err: any) {
      console.error("Invoice loading error:", err);

      setError(
        err?.message ||
          "Could not load your invoices and timesheets.",
      );
    } finally {
      setLoading(false);
    }
  }

  function getShift(item: Timesheet): Shift {
    if (!item.shifts) {
      return {};
    }

    if (Array.isArray(item.shifts)) {
      return item.shifts[0] || {};
    }

    return item.shifts;
  }

  function getGrossAmount(item: Timesheet) {
    const storedTotal = Number(item.total_amount || 0);

    if (storedTotal > 0) {
      return storedTotal;
    }

    const rate = Number(item.agreed_rate || 0);
    const hours = Number(item.hours_worked || 0);

    return rate * hours;
  }

  function getLocumAmount(item: Timesheet) {
  return getGrossAmount(item);
}

function getPlatformFee(item: Timesheet) {
  return getLocumAmount(item) * 0.1;
}

function getEmployerTotal(item: Timesheet) {
  return getLocumAmount(item) + getPlatformFee(item);
}

  function invoiceNumber(item: Timesheet) {
    const date =
      item.work_date?.replaceAll("-", "") ||
      new Date().toISOString().slice(0, 10).replaceAll("-", "");

    const shortId = item.id
      .replaceAll("-", "")
      .slice(0, 6)
      .toUpperCase();

    return `CS-${date}-${shortId}`;
  }

  function formatMoney(value: number | null | undefined) {
    return `R${Number(value || 0).toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";

    const date = new Date(
      value.length === 10 ? `${value}T00:00:00` : value,
    );

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatTime(value?: string | null) {
    if (!value) return "—";

    return value.slice(0, 5);
  }

  function printInvoice(item: Timesheet) {
    const shift = getShift(item);

    const gross = getGrossAmount(item);
    const fee = getPlatformFee(item);
    const payout = getLocumAmount(item);

    const number = invoiceNumber(item);

    const invoiceWindow = window.open(
      "",
      "_blank",
      "width=1000,height=900",
    );

    if (!invoiceWindow) {
      setError(
        "Your browser blocked the invoice window. Please allow pop-ups and try again.",
      );
      return;
    }

    const fullName =
      [profile?.first_name, profile?.surname]
        .filter(Boolean)
        .join(" ") || "Healthcare Professional";

    const employerName =
      shift.business_name || "CareStaffing Employer";

    invoiceWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${escapeHtml(number)}</title>

          <meta charset="UTF-8" />

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 40px;
              font-family: Arial, Helvetica, sans-serif;
              color: #0f172a;
              background: #ffffff;
            }

            .invoice {
              max-width: 900px;
              margin: 0 auto;
            }

            .header {
              background: linear-gradient(135deg, #0f172a, #0f766e);
              color: white;
              border-radius: 22px;
              padding: 32px;
              display: flex;
              justify-content: space-between;
              gap: 30px;
              align-items: flex-start;
            }

            .brand {
              color: #99f6e4;
              font-weight: 900;
              letter-spacing: 1.5px;
              font-size: 14px;
            }

            h1 {
              margin: 8px 0 5px;
              font-size: 38px;
            }

            .invoice-number {
              font-weight: 700;
              font-size: 15px;
            }

            .status {
              display: inline-block;
              padding: 8px 13px;
              border-radius: 999px;
              background: white;
              color: #0f766e;
              font-weight: 800;
              font-size: 12px;
              text-transform: uppercase;
            }

            .section-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-top: 25px;
            }

            .box {
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 22px;
            }

            .box h2 {
              margin-top: 0;
              font-size: 18px;
            }

            .detail {
              margin: 8px 0;
              color: #334155;
            }

            .label {
              color: #64748b;
              font-size: 12px;
              margin-bottom: 3px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 25px;
            }

            th {
              background: #f1f5f9;
              text-align: left;
              padding: 13px 10px;
              font-size: 12px;
              color: #475569;
              border-bottom: 1px solid #cbd5e1;
            }

            td {
              padding: 14px 10px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 14px;
            }

            .totals {
              width: 380px;
              margin-left: auto;
              margin-top: 24px;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 20px;
            }

            .total-row {
              display: flex;
              justify-content: space-between;
              gap: 20px;
              margin: 9px 0;
            }

            .payout {
              border-top: 2px solid #0f172a;
              margin-top: 14px;
              padding-top: 14px;
              font-size: 20px;
              font-weight: 900;
              color: #0f766e;
            }

            .bank {
              background: #f8fafc;
              border-radius: 16px;
              padding: 22px;
              margin-top: 25px;
            }

            .bank h2 {
              margin-top: 0;
            }

            .bank-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
            }

            .footer {
              margin-top: 30px;
              text-align: center;
              color: #64748b;
              font-size: 12px;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
            }

            .actions {
              max-width: 900px;
              margin: 20px auto;
              display: flex;
              justify-content: flex-end;
            }

            .print-button {
              padding: 13px 20px;
              border: none;
              border-radius: 10px;
              background: #0f766e;
              color: white;
              font-weight: 800;
              cursor: pointer;
            }

            @media print {
              body {
                padding: 0;
              }

              .actions {
                display: none;
              }

              .header {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>

        <body>
          <div class="actions">
            <button
              class="print-button"
              onclick="window.print()"
            >
              Print / Save as PDF
            </button>
          </div>

          <div class="invoice">

            <header class="header">
              <div>
                <div class="brand">
                  CARESTAFFING
                </div>

                <h1>Locum Invoice</h1>

                <div class="invoice-number">
                  ${escapeHtml(number)}
                </div>
              </div>

              <div style="text-align:right">
                <div class="status">
                  ${escapeHtml(item.status || "Pending")}
                </div>

                <p>
                  Invoice date:<br/>
                  <strong>${escapeHtml(formatDate(new Date().toISOString()))}</strong>
                </p>
              </div>
            </header>

            <div class="section-grid">

              <section class="box">
                <h2>Healthcare Professional</h2>

                <div class="detail">
                  <div class="label">Name</div>
                  <strong>${escapeHtml(fullName)}</strong>
                </div>

                <div class="detail">
                  <div class="label">Profession</div>
                  ${escapeHtml(profile?.profession || "—")}
                </div>

                <div class="detail">
                  <div class="label">Registration Number</div>
                  ${escapeHtml(profile?.registration_number || "—")}
                </div>

                <div class="detail">
                  <div class="label">Practice Number</div>
                  ${escapeHtml(profile?.practice_number || "—")}
                </div>

                <div class="detail">
                  <div class="label">ID / Passport</div>
                  ${escapeHtml(profile?.id_number || "—")}
                </div>

                <div class="detail">
                  <div class="label">Email</div>
                  ${escapeHtml(profile?.email || "—")}
                </div>

                <div class="detail">
                  <div class="label">Mobile</div>
                  ${escapeHtml(profile?.mobile || "—")}
                </div>
              </section>

              <section class="box">
                <h2>Employer / Shift</h2>

                <div class="detail">
                  <div class="label">Organisation</div>
                  <strong>${escapeHtml(employerName)}</strong>
                </div>

                <div class="detail">
                  <div class="label">Shift</div>
                  ${escapeHtml(shift.title || "Healthcare Shift")}
                </div>

                <div class="detail">
                  <div class="label">Location</div>
                  ${escapeHtml(
                    shift.location ||
                    shift.city ||
                    "—"
                  )}
                </div>

                <div class="detail">
                  <div class="label">Work Date</div>
                  ${escapeHtml(formatDate(item.work_date))}
                </div>
              </section>

            </div>

            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shift</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Break</th>
                  <th>Hours</th>
                  <th>Rate</th>
                  <th>Gross</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>
                    ${escapeHtml(formatDate(item.work_date))}
                  </td>

                  <td>
                    ${escapeHtml(shift.title || "Shift")}
                  </td>

                  <td>
                    ${escapeHtml(formatTime(item.start_time))}
                  </td>

                  <td>
                    ${escapeHtml(formatTime(item.end_time))}
                  </td>

                  <td>
                    ${escapeHtml(
                      `${Number(item.break_minutes || 0)} min`
                    )}
                  </td>

                  <td>
                    ${Number(item.hours_worked || 0).toFixed(2)}
                  </td>

                  <td>
                    ${escapeHtml(
                      `${formatMoney(item.agreed_rate)}/hr`
                    )}
                  </td>

                  <td>
                    ${escapeHtml(formatMoney(gross))}
                  </td>
                </tr>
              </tbody>
            </table>

            <section class="totals">

              <div class="total-row">
                <span>Gross shift amount</span>
                <strong>
                  ${escapeHtml(formatMoney(gross))}
                </strong>
              </div>

              <div class="total-row">
                <span>CareStaffing fee (10%)</span>
                <strong>
                  -${escapeHtml(formatMoney(fee))}
                </strong>
              </div>

              <div class="total-row payout">
                <span>Locum Payout</span>
                <span>
                  ${escapeHtml(formatMoney(payout))}
                </span>
              </div>

            </section>

            <section class="bank">
              <h2>Payment / Banking Details</h2>

              <div class="bank-grid">

                <div>
                  <div class="label">Account Holder</div>
                  <strong>
                    ${escapeHtml(
                      profile?.account_holder_name ||
                      fullName
                    )}
                  </strong>
                </div>

                <div>
                  <div class="label">Bank</div>
                  <strong>
                    ${escapeHtml(profile?.bank_name || "—")}
                  </strong>
                </div>

                <div>
                  <div class="label">Account Number</div>
                  <strong>
                    ${escapeHtml(profile?.account_number || "—")}
                  </strong>
                </div>

                <div>
                  <div class="label">Branch Code</div>
                  <strong>
                    ${escapeHtml(profile?.branch_code || "—")}
                  </strong>
                </div>

                <div>
                  <div class="label">Payment Reference</div>
                  <strong>
                    ${escapeHtml(number)}
                  </strong>
                </div>

              </div>
            </section>

            <div class="footer">
              This invoice was generated from the approved CareStaffing
              shift and recorded timesheet. Hours and rates should correspond
              with the approved shift record.
            </div>

          </div>
        </body>
      </html>
    `);

    invoiceWindow.document.close();
  }

  const approvedCount = useMemo(
    () =>
      timesheets.filter(
        (item) =>
          item.status?.toLowerCase() === "approved",
      ).length,
    [timesheets],
  );

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>Loading invoices...</div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/dashboard" style={styles.back}>
          ← Back to Dashboard
        </Link>

        <section style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>CARESTAFFING</p>

            <h1 style={styles.title}>Invoices</h1>

            <p style={styles.subtitle}>
              Invoices are generated from your recorded hours,
              approved rates and professional banking details.
            </p>
          </div>

          <div style={styles.heroStats}>
            <strong style={styles.heroStatNumber}>
              {timesheets.length}
            </strong>

            <span style={styles.heroStatLabel}>
              Timesheets
            </span>

            <strong style={styles.heroStatNumber}>
              {approvedCount}
            </strong>

            <span style={styles.heroStatLabel}>
              Approved
            </span>
          </div>
        </section>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        {timesheets.length === 0 ? (
          <section style={styles.emptyCard}>
            <div style={styles.emptyIcon}>🧾</div>

            <h2>No invoices yet</h2>

            <p style={styles.muted}>
              Once you complete a shift and submit your timesheet,
              the invoice will appear here.
            </p>

            <Link href="/timesheets" style={styles.primaryLink}>
              Go to Timesheets
            </Link>
          </section>
        ) : (
          <section style={styles.grid}>
            {timesheets.map((item) => {
              const shift = getShift(item);

              const gross = getGrossAmount(item);
              const platformFee = getPlatformFee(item);
              const locumAmount = getLocumAmount(item);

              const status =
                item.status?.toLowerCase() || "pending";

              return (
                <article key={item.id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <p style={styles.invoiceLabel}>
                        INVOICE
                      </p>

                      <h2 style={styles.cardTitle}>
                        {shift.title || "Shift Invoice"}
                      </h2>

                      <p style={styles.invoiceNumber}>
                        {invoiceNumber(item)}
                      </p>
                    </div>

                    <span
                      style={{
                        ...styles.statusBadge,
                        ...(status === "approved"
                          ? styles.statusApproved
                          : status === "rejected"
                            ? styles.statusRejected
                            : styles.statusPending),
                      }}
                    >
                      {status.toUpperCase()}
                    </span>
                  </div>

                  <div style={styles.detailGrid}>
                    <Detail
                      label="Date Worked"
                      value={formatDate(item.work_date)}
                    />

                    <Detail
                      label="Location"
                      value={
                        shift.location ||
                        shift.city ||
                        "—"
                      }
                    />

                    <Detail
                      label="Started"
                      value={formatTime(item.start_time)}
                    />

                    <Detail
                      label="Ended"
                      value={formatTime(item.end_time)}
                    />

                    <Detail
                      label="Hours Worked"
                      value={`${Number(
                        item.hours_worked || 0,
                      ).toFixed(2)} hrs`}
                    />

                    <Detail
                      label="Rate"
                      value={`${formatMoney(
                        item.agreed_rate,
                      )}/hr`}
                    />
                  </div>

                  <hr style={styles.hr} />

                  <div style={styles.moneyRow}>
                    <span>Gross Shift Amount</span>
                    <strong>
                      {formatMoney(gross)}
                    </strong>
                  </div>

                  <div style={styles.moneyRow}>
                    <span>CareStaffing Fee — 10%</span>
                    <strong>
                      -{formatMoney(platformFee)}
                    </strong>
                  </div>

                  <div style={styles.payoutRow}>
                    <span>Locum Payout</span>

                    <strong>
                      {formatMoney(locumAmount)}
                    </strong>
                  </div>

                  {!profile?.bank_name ||
                  !profile?.account_number ? (
                    <div style={styles.bankWarning}>
                      ⚠ Banking details incomplete.{" "}
                      <Link
                        href="/profile"
                        style={styles.inlineLink}
                      >
                        Update Profile
                      </Link>
                    </div>
                  ) : (
                    <div style={styles.bankSummary}>
                      <strong>
                        Payment Account
                      </strong>

                      <span>
                        {profile.bank_name} ••••{" "}
                        {lastFour(profile.account_number)}
                      </span>
                    </div>
                  )}

                  <div style={styles.actions}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedInvoice(item)
                      }
                      style={styles.secondaryButton}
                    >
                      View Invoice
                    </button>

                    <button
                      type="button"
                      onClick={() => printInvoice(item)}
                      style={styles.primaryButton}
                    >
                      🧾 Print / Save PDF
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      {selectedInvoice && (
        <InvoiceModal
          item={selectedInvoice}
          profile={profile}
          shift={getShift(selectedInvoice)}
          invoiceNumber={invoiceNumber(selectedInvoice)}
          gross={getGrossAmount(selectedInvoice)}
          platformFee={getPlatformFee(selectedInvoice)}
          locumAmount={getLocumAmount(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          onPrint={() => printInvoice(selectedInvoice)}
          formatMoney={formatMoney}
          formatDate={formatDate}
          formatTime={formatTime}
        />
      )}
    </main>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.detailItem}>
      <span style={styles.detailLabel}>
        {label}
      </span>

      <strong>{value}</strong>
    </div>
  );
}

function InvoiceModal({
  item,
  profile,
  shift,
  invoiceNumber,
  gross,
  platformFee,
  locumAmount,
  onClose,
  onPrint,
  formatMoney,
  formatDate,
  formatTime,
}: any) {
  const fullName =
    [profile?.first_name, profile?.surname]
      .filter(Boolean)
      .join(" ") || "Healthcare Professional";

  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.modal}>
        <div style={styles.modalTop}>
          <div>
            <p style={styles.eyebrowDark}>
              CARESTAFFING
            </p>

            <h2 style={styles.modalTitle}>
              Locum Invoice
            </h2>

            <span style={styles.muted}>
              {invoiceNumber}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
          >
            ✕
          </button>
        </div>

        <div style={styles.modalColumns}>
          <div style={styles.modalSection}>
            <h3>Healthcare Professional</h3>

            <p>
              <b>Name:</b> {fullName}
            </p>

            <p>
              <b>Profession:</b>{" "}
              {profile?.profession || "—"}
            </p>

            <p>
              <b>Registration:</b>{" "}
              {profile?.registration_number || "—"}
            </p>
          </div>

          <div style={styles.modalSection}>
            <h3>Shift</h3>

            <p>
              <b>Shift:</b>{" "}
              {shift.title || "Healthcare Shift"}
            </p>

            <p>
              <b>Location:</b>{" "}
              {shift.location || shift.city || "—"}
            </p>

            <p>
              <b>Date:</b>{" "}
              {formatDate(item.work_date)}
            </p>
          </div>
        </div>

        <div style={styles.invoiceTable}>
          <div style={styles.tableHeader}>
            <span>Date</span>
            <span>Start</span>
            <span>End</span>
            <span>Hours</span>
            <span>Rate</span>
          </div>

          <div style={styles.tableRow}>
            <span>{formatDate(item.work_date)}</span>
            <span>{formatTime(item.start_time)}</span>
            <span>{formatTime(item.end_time)}</span>
            <span>
              {Number(item.hours_worked || 0).toFixed(2)}
            </span>
            <span>
              {formatMoney(item.agreed_rate)}
            </span>
          </div>
        </div>

        <div style={styles.modalTotals}>
          <div style={styles.moneyRow}>
            <span>Gross</span>
            <strong>{formatMoney(gross)}</strong>
          </div>

          <div style={styles.moneyRow}>
            <span>CareStaffing 10%</span>
            <strong>
              -{formatMoney(platformFee)}
            </strong>
          </div>

          <div style={styles.payoutRow}>
            <span>Locum Payout</span>
            <strong>
              {formatMoney(locumAmount)}
            </strong>
          </div>
        </div>

        <div style={styles.modalSection}>
          <h3>Banking Details</h3>

          <div style={styles.detailGrid}>
            <Detail
              label="Account Holder"
              value={
                profile?.account_holder_name ||
                fullName
              }
            />

            <Detail
              label="Bank"
              value={profile?.bank_name || "—"}
            />

            <Detail
              label="Account Number"
              value={profile?.account_number || "—"}
            />

            <Detail
              label="Branch Code"
              value={profile?.branch_code || "—"}
            />
          </div>
        </div>

        <div style={styles.modalActions}>
          <button
            type="button"
            onClick={onClose}
            style={styles.secondaryButton}
          >
            Close
          </button>

          <button
            type="button"
            onClick={onPrint}
            style={styles.primaryButton}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function lastFour(value?: string | null) {
  if (!value) return "—";

  return value.slice(-4);
}

function escapeHtml(value: any) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
  },

  container: {
    maxWidth: "1150px",
    margin: "0 auto",
  },

  back: {
    color: "#0f766e",
    fontWeight: 800,
    textDecoration: "none",
  },

  hero: {
    background:
      "linear-gradient(135deg,#0f172a,#ea580c)",
    color: "white",
    padding: "32px",
    borderRadius: "26px",
    margin: "20px 0",
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "center",
    flexWrap: "wrap",
  },

  eyebrow: {
    margin: "0 0 8px",
    color: "#fed7aa",
    fontWeight: 900,
    letterSpacing: "1px",
  },

  eyebrowDark: {
    margin: "0 0 5px",
    color: "#0f766e",
    fontWeight: 900,
    letterSpacing: "1px",
  },

  title: {
    fontSize: "38px",
    margin: 0,
  },

  subtitle: {
    color: "#ffedd5",
    maxWidth: "650px",
    lineHeight: 1.5,
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "auto auto",
    gap: "5px 12px",
    padding: "16px 20px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.10)",
  },

  heroStatNumber: {
    fontSize: "24px",
  },

  heroStatLabel: {
    color: "#fed7aa",
    alignSelf: "center",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(330px,1fr))",
    gap: "18px",
  },

  card: {
    background: "white",
    padding: "22px",
    borderRadius: "22px",
    boxShadow:
      "0 8px 24px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
    alignItems: "flex-start",
  },

  invoiceLabel: {
    margin: 0,
    color: "#ea580c",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "1px",
  },

  cardTitle: {
    margin: "5px 0",
  },

  invoiceNumber: {
    color: "#64748b",
    margin: 0,
    fontSize: "13px",
  },

  statusBadge: {
    padding: "7px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
  },

  statusApproved: {
    background: "#dcfce7",
    color: "#166534",
  },

  statusPending: {
    background: "#fef3c7",
    color: "#92400e",
  },

  statusRejected: {
    background: "#fee2e2",
    color: "#991b1b",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",
    gap: "12px",
    marginTop: "20px",
  },

  detailItem: {
    display: "grid",
    gap: "4px",
  },

  detailLabel: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 700,
  },

  hr: {
    border: "none",
    borderTop: "1px solid #e2e8f0",
    margin: "18px 0",
  },

  moneyRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    padding: "6px 0",
  },

  payoutRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    marginTop: "10px",
    paddingTop: "13px",
    borderTop: "2px solid #0f172a",
    color: "#0f766e",
    fontSize: "18px",
    fontWeight: 900,
  },

  bankSummary: {
    marginTop: "18px",
    padding: "13px",
    borderRadius: "12px",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    fontSize: "13px",
  },

  bankWarning: {
    marginTop: "18px",
    padding: "13px",
    borderRadius: "12px",
    background: "#fff7ed",
    color: "#9a3412",
    fontSize: "13px",
  },

  inlineLink: {
    color: "#9a3412",
    fontWeight: 800,
  },

  actions: {
    display: "flex",
    gap: "10px",
    marginTop: "18px",
  },

  primaryButton: {
    flex: 1,
    background: "#0f766e",
    color: "white",
    border: "none",
    padding: "12px 15px",
    borderRadius: "11px",
    fontWeight: 800,
    cursor: "pointer",
  },

  secondaryButton: {
    flex: 1,
    background: "white",
    color: "#334155",
    border: "1px solid #cbd5e1",
    padding: "12px 15px",
    borderRadius: "11px",
    fontWeight: 800,
    cursor: "pointer",
  },

  emptyCard: {
    background: "white",
    padding: "45px",
    borderRadius: "22px",
    textAlign: "center",
  },

  emptyIcon: {
    fontSize: "42px",
  },

  muted: {
    color: "#64748b",
  },

  primaryLink: {
    display: "inline-block",
    marginTop: "12px",
    background: "#0f766e",
    color: "white",
    padding: "12px 18px",
    borderRadius: "11px",
    textDecoration: "none",
    fontWeight: 800,
  },

  errorBox: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "18px",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.60)",
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: "20px",
    overflowY: "auto",
  },

  modal: {
    width: "100%",
    maxWidth: "900px",
    maxHeight: "92vh",
    overflowY: "auto",
    background: "white",
    borderRadius: "24px",
    padding: "28px",
  },

  modalTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
  },

  modalTitle: {
    margin: 0,
    fontSize: "30px",
  },

  closeButton: {
    width: "42px",
    height: "42px",
    borderRadius: "999px",
    border: "1px solid #cbd5e1",
    background: "white",
    cursor: "pointer",
    fontSize: "17px",
  },

  modalColumns: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(260px,1fr))",
    gap: "16px",
    marginTop: "24px",
  },

  modalSection: {
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "18px",
    marginTop: "18px",
  },

  invoiceTable: {
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    overflow: "hidden",
    marginTop: "20px",
  },

  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1.2fr repeat(4,1fr)",
    gap: "10px",
    background: "#f1f5f9",
    padding: "12px",
    fontWeight: 800,
    fontSize: "12px",
  },

  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr repeat(4,1fr)",
    gap: "10px",
    padding: "14px 12px",
    fontSize: "13px",
  },

  modalTotals: {
    marginTop: "20px",
    marginLeft: "auto",
    maxWidth: "420px",
  },

  modalActions: {
    display: "flex",
    gap: "12px",
    marginTop: "22px",
  },
};
