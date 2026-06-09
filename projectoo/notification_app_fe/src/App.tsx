import { useEffect, useState } from "react";
import { createLogger } from "../../logging_middleware/src/logger";

type Status = "idle" | "loading" | "success" | "error";

const env = import.meta.env as Record<string, string | undefined>;

const logger = createLogger({
  registerData: {
    email: env.VITE_EVAL_EMAIL ?? "surya2156@example.com",
    name: env.VITE_EVAL_NAME ?? "Surya",
    rollNo: env.VITE_EVAL_ROLL_NO ?? "2400320109020",
    mobileNo: env.VITE_EVAL_MOBILE_NO ?? "0000000000",
    githubUsername: env.VITE_EVAL_GITHUB_USERNAME ?? "surya2156",
    githubLink: env.VITE_EVAL_GITHUB_LINK ?? "https://github.com/surya2156/2400320109020.git",
    accessCode: env.VITE_EVAL_ACCESS_CODE ?? "240032",
    source: "react-notification-app",
  },
});

const fakeNetworkAction = async (shouldFail: boolean): Promise<string> => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (shouldFail) {
    throw new Error("Simulated dispatch failure");
  }
  return "Action completed successfully.";
};

export default function App() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("Ready to receive actions.");
  const [detail, setDetail] = useState("Click a button to simulate a lifecycle or interaction event.");

  useEffect(() => {
    const init = async () => {
      setStatus("loading");
      setMessage("Initializing notification panel...");
      try {
        await logger.log("frontend", "debug", "page", "App mount started");
        await logger.log("frontend", "info", "auth", "Registering client and requesting auth token");
        await logger.log("frontend", "info", "page", "Notification panel initialized");
        setStatus("success");
        setMessage("Notification panel is ready.");
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown initialization error.";
        await logger.log("frontend", "error", "component", `Initialization failed: ${errorMessage}`);
        setStatus("error");
        setMessage("Initialization failed.");
        setDetail(errorMessage);
      }
    };

    init();
  }, []);

  const handleAction = async (shouldFail: boolean) => {
    const actionLabel = shouldFail ? "failure" : "success";
    setStatus("loading");
    setDetail("Waiting for simulated response...");
    await logger.log("frontend", "debug", "component", `User clicked ${actionLabel} action button`);

    try {
      const result = await fakeNetworkAction(shouldFail);
      await logger.log("frontend", "info", "api", `Simulated API request succeeded for ${actionLabel} action`);
      setStatus("success");
      setMessage("Success");
      setDetail(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await logger.log("frontend", "warn", "api", `Simulated API request failed: ${errorMessage}`);
      setStatus("error");
      setMessage("Failure");
      setDetail(errorMessage);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <h1 style={styles.title}>Notification Panel</h1>
        <p style={styles.subtitle}>A clean frontend event panel with middleware-backed logging.</p>

        <div style={styles.statusCard}>
          <div>
            <span style={styles.statusLabel}>Current state</span>
            <strong style={styles.statusValue}>{status.toUpperCase()}</strong>
          </div>
          <p style={styles.message}>{message}</p>
          <p style={styles.detail}>{detail}</p>
        </div>

        <div style={styles.buttonRow}>
          <button style={styles.primaryButton} onClick={() => handleAction(false)}>
            Simulate Success
          </button>
          <button style={styles.secondaryButton} onClick={() => handleAction(true)}>
            Simulate Failure
          </button>
        </div>

        <footer style={styles.footer}>
          <span>Events are logged via middleware.</span>
        </footer>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
    padding: "24px",
  },
  panel: {
    width: "100%",
    maxWidth: "520px",
    background: "#ffffff",
    borderRadius: "20px",
    boxShadow: "0 24px 80px rgba(15, 23, 42, 0.12)",
    padding: "32px",
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  title: {
    margin: 0,
    fontSize: "2rem",
    color: "#0f172a",
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.5,
  },
  statusCard: {
    padding: "22px",
    borderRadius: "18px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: "14px",
  },
  statusLabel: {
    display: "block",
    color: "#64748b",
    marginBottom: "6px",
    fontSize: "0.9rem",
  },
  statusValue: {
    fontSize: "1.5rem",
    color: "#0f172a",
  },
  message: {
    margin: 0,
    color: "#334155",
    fontWeight: 500,
  },
  detail: {
    margin: 0,
    color: "#475569",
    fontSize: "0.95rem",
    lineHeight: 1.6,
  },
  buttonRow: {
    display: "grid",
    gap: "12px",
  },
  primaryButton: {
    borderRadius: "999px",
    border: "none",
    background: "#2563eb",
    color: "#ffffff",
    padding: "14px 18px",
    fontSize: "1rem",
    cursor: "pointer",
    transition: "background 160ms ease",
  },
  secondaryButton: {
    borderRadius: "999px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "14px 18px",
    fontSize: "1rem",
    cursor: "pointer",
    transition: "background 160ms ease, color 160ms ease",
  },
  footer: {
    display: "flex",
    justifyContent: "center",
    paddingTop: "6px",
    color: "#94a3b8",
    fontSize: "0.9rem",
  },
};
