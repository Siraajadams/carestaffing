import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegisterWorkerBody = {
  email?: string;
  password?: string;
  first_name?: string;
  surname?: string;
  mobile?: string;
  id_number?: string;
  country?: string;
  dialing_code?: string;
  profession?: string;
  registration_number?: string;
  practice_number?: string;
  gender?: string;
  date_of_birth?: string;
  city?: string;
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
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      );

      return NextResponse.json(
        {
          error:
            "Server registration is not configured. Please contact CareStaffing support.",
        },
        { status: 500 },
      );
    }

    const body = (await request.json()) as RegisterWorkerBody;

    const email = clean(body.email).toLowerCase();
    const password = String(body.password || "");
    const firstName = clean(body.first_name);
    const surname = clean(body.surname);
    const mobile = clean(body.mobile);
    const idNumber = clean(body.id_number);
    const country = clean(body.country) || "South Africa";
    const dialingCode = clean(body.dialing_code) || "+27";
    const profession = clean(body.profession);
    const registrationNumber = clean(body.registration_number);
    const practiceNumber = clean(body.practice_number);
    const gender = clean(body.gender);
    const dateOfBirth = clean(body.date_of_birth);
    const city = clean(body.city);

    if (
      !email ||
      !password ||
      !firstName ||
      !surname ||
      !mobile ||
      !idNumber ||
      !profession ||
      !registrationNumber ||
      !gender ||
      !dateOfBirth
    ) {
      return NextResponse.json(
        { error: "Please complete all required registration fields." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must contain at least 8 characters." },
        { status: 400 },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    /*
     * IMPORTANT:
     * email_confirm: true creates the user as already confirmed.
     * Supabase therefore does NOT send the normal confirmation email.
     */
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          surname,
          mobile,
          id_number: idNumber,
          country,
          dialing_code: dialingCode,
          profession,
          registration_number: registrationNumber,
          practice_number: practiceNumber,
          gender,
          date_of_birth: dateOfBirth,
          city,
          role: "worker",
          account_type: "worker",
          platform: "CareStaffing",
        },
      });

    if (createError || !created.user) {
      console.error("Create worker auth error:", createError);

      return NextResponse.json(
        {
          error:
            createError?.message ||
            "Could not create the CareStaffing account.",
        },
        { status: 400 },
      );
    }

    const userId = created.user.id;

    const profilePayload = {
      id: userId,
      first_name: firstName,
      surname,
      email,
      mobile,
      id_number: idNumber,
      country,
      dialing_code: dialingCode,
      profession,
      registration_number: registrationNumber,
      practice_number: practiceNumber || null,
      gender,
      date_of_birth: dateOfBirth,
      city: city || null,
      role: "worker",
      account_type: "worker",
      organisation_name: null,
      company_id: null,
      platform: "CareStaffing",
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(profilePayload, {
        onConflict: "id",
      });

    if (profileError) {
      console.error("Create worker profile error:", profileError);

      /*
       * Keep Auth and profiles consistent. If the profile cannot be
       * created, remove the Auth user so the worker can safely retry.
       */
      await admin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        {
          error:
            profileError.message ||
            "The account was created but the worker profile could not be saved.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        user_id: userId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Register worker API error:", error);

    return NextResponse.json(
      {
        error:
          "Unexpected registration error. Please try again.",
      },
      { status: 500 },
    );
  }
}
