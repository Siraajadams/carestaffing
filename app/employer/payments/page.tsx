import { Suspense } from "react";
import EmployerPaymentsClient from "./EmployerPaymentsClient";

export const dynamic = "force-dynamic";

export default function EmployerPaymentsPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            fontFamily: "Arial, sans-serif",
            background: "#f1f5f9",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "24px",
              borderRadius: "18px",
              fontWeight: 800,
            }}
          >
            Loading employer payments...
          </div>
        </main>
      }
    >
      <EmployerPaymentsClient />
    </Suspense>
  );
}
