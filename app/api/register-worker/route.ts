import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegisterAccountBody = {
  email?: string;
  password?: string;
  first_name?: string;
  surname?: string;
  organisation_name?: string;
  mobile?: string;
  profession?: string;
  registration_number?: string;
  date_of_birth?: string | null;
  age?: number | null;
  gender?: string;
  country?: string;
  city?: string;
  role?: "worker" | "employer";
  account_type?: "worker" | "employer";
  platform?: string;
  requires_permit_document?: boolean;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );

      return NextResponse.json(
        {
          error:
            "CareStaffing registration is not configured on the server.",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as RegisterAccountBody;

    const email = clean(body.email).toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must contain at least 8 characters." },
        { status: 400 }
      );
    }

    const role =
      body.role === "employer" ? "employer" : "worker";

    const accountType =
      body.account_type === "employer" ? "employer" : "worker";

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,

      /*
       * Critical setting:
       * the user is created with a confirmed email, so Supabase does
       * not send the standard confirmation email / opt-out link.
       */
      email_confirm: true,

      user_metadata: {
        first_name: clean(body.first_name),
        surname: clean(body.surname),
        organisation_name: clean(body.organisation_name),
        mobile: clean(body.mobile),
        profession: clean(body.profession),
        registration_number: clean(body.registration_number),
        date_of_birth: body.date_of_birth || null,
        age:
          typeof body.age === "number" && Number.isFinite(body.age)
            ? body.age
            : null,
        gender: clean(body.gender),
        country: clean(body.country),
        city: clean(body.city),
        role,
        account_type: accountType,
        platform: "CareStaffing",
        requires_permit_document:
          Boolean(body.requires_permit_document),
      },
    });

    if (error || !data.user) {
      console.error("CareStaffing create user error:", error);

      const message = error?.message || "Could not create account.";
      const lower = message.toLowerCase();

      if (
        lower.includes("already") ||
        lower.includes("exists") ||
        lower.includes("registered")
      ) {
        return NextResponse.json(
          {
            error:
              "An account already exists for this email address. Please use Login.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        user_id: data.user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CareStaffing register-account error:", error);

    return NextResponse.json(
      {
        error:
          "Unexpected registration error. Please try again.",
      },
      { status: 500 }
    );
  }
}
