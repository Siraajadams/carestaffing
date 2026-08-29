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

    const [{ data: profiles, error: profileError }, { data: companies, error: companyError }] =
      await Promise.all([
        admin.from("profiles").select("*"),
        admin.from("companies").select("*"),
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

    return NextResponse.json(
      {
        ok: true,
        totals: {
          profiles: allProfiles.length,
          locums: locums.length,
          companies: companyEmployers.length,
          employers: companyEmployers.length + profileEmployers.length,
        },
        locums,
        employers: [...companyEmployers, ...profileEmployers],
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
