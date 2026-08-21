import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <div className="auth-glow" />

      <div className="auth-content">
        <div className="auth-heading">
          <div className="auth-badge">POS STORE APPLICATION</div>
          <h1>Create Restaurant Account</h1>
          <p>Register an account to access your restaurant workspace and POS tools.</p>
        </div>

        <div className="auth-card-wrap">
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/"
            forceRedirectUrl="/"
            appearance={{
              variables: {
                colorPrimary: "#6366f1",
                colorBackground: "#0f172a",
                colorInputBackground: "#1e293b",
                colorInputText: "#ffffff",
                colorText: "#f8fafc",
                colorTextSecondary: "#cbd5e1",
                borderRadius: "0.75rem",
              },
              elements: {
                rootBox: "w-full",
                cardBox: "w-full shadow-2xl rounded-xl",
                card: "auth-clerk-card",
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

        <p className="auth-footer">Secure restaurant workspace for authorized users.</p>
      </div>
    </main>
  );
}
