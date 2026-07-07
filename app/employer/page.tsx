"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const countries = [
  { name: "South Africa", code: "+27" },
  { name: "United Kingdom", code: "+44" },
  { name: "New Zealand", code: "+64" },
  { name: "Ireland", code: "+353" },
];

const provinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

export default function EmployerPage() {
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [profession, setProfession] = useState("Pharmacist");
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("South Africa");
  const [dialingCode, setDialingCode] = useState("+27");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [shiftDate, setShiftDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [rateType, setRateType] = useState("Hourly");
  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState("");

  const employerRate = Number(rate || 0);
  const locumRate = employerRate * 0.9;
  const adminFee = employerRate * 0.1;

  useEffect(() => {
    loadCompany();
  }, []);

  async function loadCompany() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("companies")
      .select("id,name,city,country")
      .eq("owner_id", user.id)
      .single();

    if (data) {
      setCompanyId(data.id);
      setBusinessName(data.name || "");
      setCity(data.city || "");
      if (data.country) updateCountry(data.country);
    }
  }

  function updateCountry(value: string) {
    const selected = countries.find((c) => c.name === value);
    setCountry(value);
    setDialingCode(selected?.code || "");
  }

  async function postShift(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("shifts").insert({
      company_id: companyId,
      title,
      profession_required: profession,
      business_name: businessName,
      country,
      dialing_code: dialingCode,
      province,
      city,
      address,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      rate_type: rateType.toLowerCase(),

      employer_rate: employerRate,
      hourly_rate: locumRate,
      locum_rate: locumRate,
      platform_fee_per_hour: adminFee,

      notes,
      status: "open",
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      `Shift posted. Organisation rate R${employerRate.toFixed(
        2
      )}. Locum sees R${locumRate.toFixed(2)}. CareStaffing fee R${adminFee.toFixed(2)}.`
    );

    setTitle("");
    setProvince("");
    setAddress("");
    setShiftDate("");
    setStartTime("");
    setEndTime("");
    setRate("");
    setNotes("");
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/employer-dashboard" style={styles.back}>
          ← Employer Dashboard
        </Link>

        <div style={styles.hero}>
          <h1>Post New Shift</h1>
          <p>
            The organisation rate includes CareStaffing’s 10% admin fee.
            Locums will only see 90% of the agreed rate.
          </p>
        </div>

        <form onSubmit={postShift} style={styles.card}>
          <label>Shift Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} placeholder="Pharmacist Locum" required />

          <label>Profession</label>
          <select value={profession} onChange={(e) => setProfession(e.target.value)} style={styles.input}>
            <option>Pharmacist</option>
            <option>Doctor</option>
            <option>Nurse</option>
            <option>Physiotherapist</option>
            <option>Biokinetist</option>
            <option>Dentist</option>
            <option>Psychologist</option>
            <option>Locum GP</option>
          </select>

          <label>Name of Business</label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} style={styles.input} placeholder="Palmyra Pharmacy" required />

          <label>Country</label>
          <select value={country} onChange={(e) => updateCountry(e.target.value)} style={styles.input}>
            {countries.map((item) => (
              <option key={item.name}>{item.name}</option>
            ))}
          </select>

          <label>Dialling Code</label>
          <input value={dialingCode} readOnly style={styles.disabledInput} />

          <label>Province</label>
          <select value={province} onChange={(e) => setProvince(e.target.value)} style={styles.input} required>
            <option value="">Select Province</option>
            {provinces.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <label>City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} style={styles.input} placeholder="Cape Town" required />

          <label>Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} style={styles.input} placeholder="Full branch address" required />

          <label>Date</label>
          <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} style={styles.input} required />

          <div style={styles.row}>
            <div>
              <label>Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={styles.input} />
            </div>

            <div>
              <label>End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={styles.input} />
            </div>
          </div>

          <label>Rate Type</label>
          <select value={rateType} onChange={(e) => setRateType(e.target.value)} style={styles.input}>
            <option>Hourly</option>
            <option>Daily</option>
            <option>Session</option>
          </select>

          <label>Organisation Agreed Rate (R)</label>
          <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} style={styles.input} required />

          <div style={styles.breakdown}>
            <b>Rate Breakdown</b>
            <p>Organisation pays: R{employerRate.toFixed(2)}</p>
            <p>Locum sees: R{locumRate.toFixed(2)}</p>
            <p>CareStaffing 10% fee: R{adminFee.toFixed(2)}</p>
          </div>

          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={styles.textarea} placeholder="SAPC registration required..." />

          {message && <div style={styles.message}>{message}</div>}

          <button disabled={loading} style={styles.button}>
            {loading ? "Posting..." : "Post Shift"}
          </button>
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f8fafc", padding: 30, fontFamily: "Arial, sans-serif" },
  container: { maxWidth: 900, margin: "0 auto" },
  back: { textDecoration: "none", color: "#0f766e", fontWeight: 700 },
  hero: { background: "linear-gradient(135deg,#0f172a,#0f766e)", padding: 30, borderRadius: 20, color: "white", margin: "20px 0" },
  card: { display: "grid", gap: 14, background: "white", padding: 30, borderRadius: 20, boxShadow: "0 10px 25px rgba(0,0,0,.08)" },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 },
  input: { width: "100%", padding: 14, borderRadius: 12, border: "1px solid #cbd5e1", boxSizing: "border-box" },
  disabledInput: { width: "100%", padding: 14, borderRadius: 12, border: "1px solid #cbd5e1", background: "#f1f5f9", boxSizing: "border-box" },
  textarea: { minHeight: 120, padding: 14, borderRadius: 12, border: "1px solid #cbd5e1", boxSizing: "border-box" },
  breakdown: { background: "#ecfeff", border: "1px solid #99f6e4", padding: 16, borderRadius: 14, color: "#134e4a" },
  button: { padding: 16, background: "#0f766e", color: "white", border: "none", borderRadius: 14, fontWeight: 700, cursor: "pointer" },
  message: { padding: 14, background: "#dcfce7", borderRadius: 12 },
};
