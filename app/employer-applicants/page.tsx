"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Applicant = {
  id: string;
  status: string;
  applied_at: string;

  profiles: {
    first_name: string;
    surname: string;
    profession: string;
    registration_number: string;
    mobile: string;
    email: string;
  };

  shifts: {
    id: string;
    title: string;
    shift_date: string;
    location: string;
    hourly_rate: number;
  };
};

export default function EmployerApplicantsPage() {
  const [applications, setApplications] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadApplicants();
  }, []);

  async function loadApplicants() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!company) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("shift_applications")
      .select(`
        id,
        status,
        applied_at,

        profiles(
          first_name,
          surname,
          profession,
          registration_number,
          mobile,
          email
        ),

        shifts(
          id,
          title,
          shift_date,
          location,
          hourly_rate
        )
      `)
      .eq("company_id", company.id)
      .order("applied_at", { ascending: false });

    setApplications((data as Applicant[]) || []);
    setLoading(false);
  }

  async function approve(id: string) {
    await supabase
      .from("shift_applications")
      .update({ status: "approved" })
      .eq("id", id);

    setMessage("Applicant approved.");
    loadApplicants();
  }

  async function decline(id: string) {
    await supabase
      .from("shift_applications")
      .update({ status: "declined" })
      .eq("id", id);

    setMessage("Applicant declined.");
    loadApplicants();
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        <Link href="/employer-dashboard" style={styles.back}>
          ← Employer Dashboard
        </Link>

        <div style={styles.hero}>
          <h1>Shift Applicants</h1>

          <p>
            Review all locums that have applied for your vacancies.
          </p>
        </div>

        {message && (
          <div style={styles.message}>
            {message}
          </div>
        )}

        {loading && <p>Loading...</p>}

        {!loading && applications.length === 0 && (
          <div style={styles.empty}>
            No applications received yet.
          </div>
        )}

        <div style={styles.grid}>

          {applications.map((app) => (

            <div key={app.id} style={styles.card}>

              <div style={styles.header}>

                <div>

                  <h2>
                    {app.profiles.first_name} {app.profiles.surname}
                  </h2>

                  <p>{app.profiles.profession}</p>

                </div>

                <span style={status(app.status)}>
                  {app.status}
                </span>

              </div>

              <hr />

              <h3>{app.shifts.title}</h3>

              <p><b>Date:</b> {app.shifts.shift_date}</p>

              <p><b>Location:</b> {app.shifts.location}</p>

              <p><b>Rate:</b> R{app.shifts.hourly_rate}</p>

              <hr />

              <p>
                <b>Registration:</b><br />
                {app.profiles.registration_number || "-"}
              </p>

              <p>
                <b>Email:</b><br />
                {app.profiles.email}
              </p>

              <p>
                <b>Mobile:</b><br />
                {app.profiles.mobile}
              </p>

              {app.status === "pending" && (

                <div style={styles.buttons}>

                  <button
                    style={styles.approve}
                    onClick={() => approve(app.id)}
                  >
                    ✔ Approve
                  </button>

                  <button
                    style={styles.decline}
                    onClick={() => decline(app.id)}
                  >
                    ✖ Decline
                  </button>

                </div>

              )}

            </div>

          ))}

        </div>

      </div>
    </main>
  );
}

function status(status: string): React.CSSProperties {

  if (status === "approved")
    return {
      background: "#dcfce7",
      color: "#166534",
      padding: "6px 12px",
      borderRadius: 20,
      fontWeight: 700,
    };

  if (status === "declined")
    return {
      background: "#fee2e2",
      color: "#991b1b",
      padding: "6px 12px",
      borderRadius: 20,
      fontWeight: 700,
    };

  return {
    background: "#fef3c7",
    color: "#92400e",
    padding: "6px 12px",
    borderRadius: 20,
    fontWeight: 700,
  };
}

const styles: Record<string, React.CSSProperties> = {

page:{
background:"#f8fafc",
minHeight:"100vh",
padding:30,
fontFamily:"Arial"
},

container:{
maxWidth:1200,
margin:"0 auto"
},

back:{
textDecoration:"none",
fontWeight:700,
color:"#0f766e"
},

hero:{
background:"linear-gradient(135deg,#0f172a,#0f766e)",
color:"white",
padding:30,
borderRadius:20,
margin:"20px 0"
},

message:{
background:"#dcfce7",
padding:14,
borderRadius:12,
marginBottom:20
},

grid:{
display:"grid",
gridTemplateColumns:"repeat(auto-fit,minmax(350px,1fr))",
gap:20
},

card:{
background:"white",
padding:24,
borderRadius:20,
boxShadow:"0 10px 25px rgba(0,0,0,.08)"
},

header:{
display:"flex",
justifyContent:"space-between",
alignItems:"center"
},

buttons:{
display:"flex",
gap:12,
marginTop:20
},

approve:{
flex:1,
background:"#16a34a",
color:"white",
border:"none",
padding:14,
borderRadius:12,
fontWeight:700,
cursor:"pointer"
},

decline:{
flex:1,
background:"#dc2626",
color:"white",
border:"none",
padding:14,
borderRadius:12,
fontWeight:700,
cursor:"pointer"
},

empty:{
background:"white",
padding:40,
borderRadius:20,
textAlign:"center"
}

};
