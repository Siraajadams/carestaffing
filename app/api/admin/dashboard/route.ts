import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function lower(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Admin dashboard server configuration is missing." },
        { status: 500 },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [
      { data: profiles, error: profileError },
      { data: companies, error: companyError },
      { data: shifts, error: shiftsError },
      { data: applications, error: applicationsError },
    ] = await Promise.all([
      admin.from("profiles").select("*"),
      admin.from("companies").select("*"),
      admin.from("shifts").select("*"),
      admin.from("shift_applications").select("*"),
    ]);

    if (profileError) {
      return NextResponse.json(
        { error: `Profiles load failed: ${profileError.message}` },
        { status: 500 },
      );
    }

    if (companyError) {
      return NextResponse.json(
        { error: `Companies load failed: ${companyError.message}` },
        { status: 500 },
      );
    }

    if (shiftsError) {
      return NextResponse.json(
        { error: `Shifts load failed: ${shiftsError.message}` },
        { status: 500 },
      );
    }

    if (applicationsError) {
      return NextResponse.json(
        { error: `Shift applications load failed: ${applicationsError.message}` },
        { status: 500 },
      );
    }

    const allProfiles = profiles || [];

    const locums = allProfiles
      .filter((p: any) => {
        const isWorker =
          lower(p.role) === "worker" ||
          lower(p.account_type) === "worker" ||
          lower(p.role_type) === "worker";
        return isWorker && Boolean(clean(p.profession));
      })
      .map((p: any) => ({
        id: p.id,
        first_name: p.first_name || null,
        surname: p.surname || null,
        email: p.email || null,
        mobile: p.mobile || p.mobile_number || null,
        profession: p.profession || null,
        province: p.province || null,
        city: p.city || p.city_area || null,
        registration_number:
          p.registration_number ||
          p.professional_registration_number ||
          null,
        role: p.role || null,
        account_type: p.account_type || null,
        role_type: p.role_type || null,
        organisation_name: p.organisation_name || null,
        company_id: p.company_id || null,
      }));

    const companyEmployers = (companies || []).map((c: any) => ({
      id: String(c.id),
      business_name:
        c.name || c.business_name || c.organisation_name || "Employer",
      province: c.province || null,
      city: c.city || null,
      email: c.email || null,
      phone: c.phone || c.mobile || c.contact_number || null,
      owner_id: c.owner_id || null,
      source: "company",
    }));

    const companyOwnerIds = new Set(
      companyEmployers.map((c: any) => c.owner_id).filter(Boolean),
    );

    const employerValues = new Set([
      "employer",
      "organisation",
      "organization",
      "company",
    ]);

    const profileEmployers = allProfiles
      .filter((p: any) => {
        const isEmployer =
          employerValues.has(lower(p.role)) ||
          employerValues.has(lower(p.account_type)) ||
          employerValues.has(lower(p.role_type)) ||
          Boolean(clean(p.organisation_name));

        return isEmployer && !companyOwnerIds.has(p.id);
      })
      .map((p: any) => ({
        id: `profile-${p.id}`,
        business_name:
          clean(p.organisation_name) ||
          [clean(p.first_name), clean(p.surname)].filter(Boolean).join(" ") ||
          "Employer",
        province: p.province || null,
        city: p.city || p.city_area || null,
        email: p.email || null,
        phone: p.mobile || p.mobile_number || null,
        owner_id: p.id,
        source: "profile",
      }));

    const companyById = new Map(
      (companies || []).map((company: any) => [String(company.id), company]),
    );

    const acceptedStatuses = new Set([
      "accepted",
      "approved",
      "confirmed",
      "booked",
      "assigned",
      "successful",
    ]);

    const unavailableShiftStatuses = new Set([
      "cancelled",
      "canceled",
      "closed",
      "completed",
      "filled",
      "expired",
    ]);

    const acceptedByShift = new Map<string, number>();

    (applications || []).forEach((application: any) => {
      const applicationStatus = lower(application.status);
      if (!acceptedStatuses.has(applicationStatus)) return;

      const shiftId =
        application.shift_id ||
        application.shiftId ||
        application.shift ||
        null;

      if (!shiftId) return;

      const key = String(shiftId);
      acceptedByShift.set(key, (acceptedByShift.get(key) || 0) + 1);
    });

    const openLocumShifts = (shifts || []).map((shift: any) => {
      const shiftId = String(shift.id);
      const status = lower(shift.status) || "open";

      const requestedRaw =
        shift.number_required ??
        shift.locums_required ??
        shift.positions ??
        shift.quantity ??
        shift.headcount ??
        1;

      const requested =
        Number.isFinite(Number(requestedRaw)) && Number(requestedRaw) > 0
          ? Number(requestedRaw)
          : 1;

      const acceptedFromApplications = acceptedByShift.get(shiftId) || 0;

      const acceptedFromShift =
        shift.accepted_count ??
        shift.filled_positions ??
        shift.locums_accepted ??
        (shift.accepted_locum_id ||
        shift.assigned_worker_id ||
        shift.locum_id ||
        shift.worker_id
          ? 1
          : 0);

      const accepted = Math.max(
        acceptedFromApplications,
        Number(acceptedFromShift) || 0,
      );

      const remaining = unavailableShiftStatuses.has(status)
        ? 0
        : Math.max(requested - accepted, 0);

      const companyId =
        shift.company_id ||
        shift.employer_id ||
        shift.organisation_id ||
        shift.organization_id ||
        null;

      const company = companyId
        ? companyById.get(String(companyId))
        : undefined;

      return {
        id: shiftId,
        title:
          shift.title ||
          shift.shift_title ||
          shift.description ||
          "Locum shift",
        profession:
          shift.profession_required ||
          shift.profession ||
          shift.profession_type ||
          "Not specified",
        employer:
          shift.business_name ||
          shift.company_name ||
          shift.organisation_name ||
          shift.organization_name ||
          company?.name ||
          company?.business_name ||
          "Employer",
        province:
          shift.province ||
          company?.province ||
          null,
        city:
          shift.city ||
          shift.location ||
          company?.city ||
          null,
        shift_date:
          shift.shift_date ||
          shift.start_date ||
          shift.date ||
          null,
        start_time: shift.start_time || null,
        end_time: shift.end_time || null,
        status,
        requested,
        accepted,
        remaining,
        is_available: remaining > 0,
      };
    });

    const demandByProfession: Record<
      string,
      { shifts: number; requested: number; accepted: number; available: number }
    > = {};

    openLocumShifts.forEach((shift: any) => {
      const profession = shift.profession || "Not specified";

      if (!demandByProfession[profession]) {
        demandByProfession[profession] = {
          shifts: 0,
          requested: 0,
          accepted: 0,
          available: 0,
        };
      }

      demandByProfession[profession].shifts += 1;
      demandByProfession[profession].requested += shift.requested;
      demandByProfession[profession].accepted += shift.accepted;
      demandByProfession[profession].available += shift.remaining;
    });

    const demandSummary = Object.entries(demandByProfession)
      .map(([profession, counts]) => ({
        profession,
        ...counts,
      }))
      .sort((a, b) => b.available - a.available || b.shifts - a.shifts);

    const totalRequested = openLocumShifts.reduce(
      (sum: number, shift: any) => sum + shift.requested,
      0,
    );

    const totalAccepted = openLocumShifts.reduce(
      (sum: number, shift: any) => sum + shift.accepted,
      0,
    );

    const totalAvailable = openLocumShifts.reduce(
      (sum: number, shift: any) => sum + shift.remaining,
      0,
    );

    return NextResponse.json(
      {
        ok: true,
        totals: {
          profiles: allProfiles.length,
          locums: locums.length,
          companies: companyEmployers.length,
          employers: companyEmployers.length + profileEmployers.length,
          locum_requests: totalRequested,
          locums_accepted: totalAccepted,
          locums_still_available: totalAvailable,
        },
        locums,
        employers: [...companyEmployers, ...profileEmployers],
        open_locum_shifts: openLocumShifts,
        demand_by_profession: demandSummary,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin dashboard API error:", error);
    return NextResponse.json(
      { error: "Unexpected admin dashboard error." },
      { status: 500 },
    );
  }
}
