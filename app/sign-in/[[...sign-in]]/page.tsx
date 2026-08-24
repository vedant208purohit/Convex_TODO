import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#020617",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        position: "relative",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Background ambient radial glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "600px",
          backgroundColor: "rgba(99, 102, 241, 0.15)",
          filter: "blur(140px)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: "440px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        {/* Branding Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "inline-block",
              padding: "0.35rem 0.85rem",
              backgroundColor: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              color: "#a5b4fc",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: "700",
              marginBottom: "0.75rem",
              letterSpacing: "0.05em",
            }}
          >
            POS MASTER CONTROL PLANE
          </div>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: "800",
              color: "#ffffff",
              letterSpacing: "-0.025em",
              marginBottom: "0.5rem",
            }}
          >
            Restaurant Owner / Admin Login
          </h1>
          <p style={{ fontSize: "0.9rem", color: "#cbd5e1" }}>
            Sign in with your authorized restaurant owner or administrator credentials to access the control plane
          </p>
        </div>

        {/* Standalone Clerk Login Card Container */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <SignIn
            routing="path"
            path="/sign-in"
            fallbackRedirectUrl="/"
            forceRedirectUrl="/"
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "w-full shadow-2xl rounded-xl",
                card: "bg-slate-900 border border-slate-700 text-white p-6 w-full shadow-2xl rounded-xl",
                footer: "hidden",
                footerAction: "hidden",
                headerTitle: "text-white font-bold text-xl",
                headerSubtitle: "text-slate-300 text-sm",
                socialButtonsBlockButton:
                  "bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 transition-colors",
                formFieldLabel: "text-white font-semibold text-sm mb-1.5",
                formFieldInput:
                  "bg-slate-800 border border-slate-600 text-white placeholder-slate-400 focus:border-indigo-400 focus:bg-slate-900 transition-colors rounded-lg text-base p-3",
                  otpCodeFieldInput:
  "bg-slate-800 border border-slate-600 text-white focus:border-indigo-400 rounded-lg",
                formButtonPrimary:
                  "bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base transition-colors rounded-lg py-3 shadow-lg shadow-indigo-500/30",
                identityPreviewText: "text-white font-medium",
                identityPreviewEditButtonIcon: "text-indigo-400",
                dividerLine: "bg-slate-700",
                dividerText: "text-slate-400 text-xs uppercase font-medium",
              },
            }}
          />
        </div>

        {/* Security Footer */}
        <p
          style={{
            marginTop: "1.5rem",
            fontSize: "0.75rem",
            color: "#94a3b8",
            fontWeight: "500",
          }}
        >
          Protected System • Access restricted to authorized system administrators
        </p>
      </div>
    </main>
  );
}
