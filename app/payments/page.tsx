import { Suspense } from "react";
import PaymentsClient from "./PaymentsClient";

export const dynamic = "force-dynamic";

export default function PaymentsPage() {
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
            Loading payments...
          </div>
        </main>
      }
    >
      <PaymentsClient />
    </Suspense>
  );
}
