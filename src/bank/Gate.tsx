/**
 * The sign-in gate of the bank edition. The workspace code and its data are
 * only requested after the server has accepted the session.
 */
import { useEffect, useState, type ComponentType, type FormEvent } from "react";
import { setViewer } from "../components/bcp/edition";
import { setBankData, type BankData } from "./store";

const es = (() => {
  try {
    return localStorage.getItem("bcp-lang") !== "en";
  } catch {
    return true;
  }
})();
const t = (a: string, b: string) => (es ? a : b);

async function openWorkspace(): Promise<ComponentType<{ onLogout: () => void }> | null> {
  const res = await fetch("/api/data", { credentials: "same-origin" });
  if (!res.ok) return null;
  const body = (await res.json()) as { viewer: string; data: BankData };
  setBankData(body.data);
  setViewer(body.viewer);
  return (await import("./BankApp")).BankApp;
}

export function Gate() {
  const [App, setApp] = useState<{ C: ComponentType<{ onLogout: () => void }> } | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);

  useEffect(() => {
    openWorkspace()
      .then((C) => C && setApp({ C }))
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: f.get("email"), password: f.get("password"), code: f.get("code") }),
      });
      if (res.status === 401 && ((await res.clone().json().catch(() => ({}))) as { needsCode?: boolean }).needsCode) {
        setNeedsCode(true);
        return;
      }
      const C = res.ok ? await openWorkspace() : null;
      if (C) setApp({ C });
      else setError(res.status === 429 ? t("Demasiados intentos. Intente más tarde.", "Too many attempts. Try again later.") : t("Datos de acceso incorrectos.", "Incorrect sign-in details."));
    } catch {
      setError(t("No se pudo conectar.", "Could not connect."));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    window.location.replace("/");
  };

  if (App) return <App.C onLogout={logout} />;
  if (checking) return <div className="min-h-screen bg-tm-neutral-light" aria-busy="true" />;
  const input = "mt-1 min-h-[44px] w-full rounded-lg border border-tm-border px-3 text-sm";
  return (
    <main className="flex min-h-screen items-center justify-center bg-tm-neutral-light px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-tm-border bg-white p-6">
        <div className="text-center">
          <img src="/logo-mark.svg" alt="TruMarket" className="mx-auto h-12 w-auto" />
          <h1 className="mt-3 text-lg font-bold">{t("Precosecha", "Pre-harvest")}</h1>
          <p className="text-sm text-tm-text-muted">{t("Acceso solo por invitación", "Invitation-only access")}</p>
        </div>
        <label className="block text-sm font-semibold">
          {t("Correo", "Email")}
          <input name="email" type="email" required autoComplete="username" className={input} />
        </label>
        <label className="block text-sm font-semibold">
          {t("Contraseña", "Password")}
          <input name="password" type="password" required autoComplete="current-password" className={input} />
        </label>
        {needsCode && (
        <label className="block text-sm font-semibold">
          {t("Código de verificación (6 dígitos)", "Verification code (6 digits)")}
          <input name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" className={input} />
        </label>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-tm-danger">{error}</p>}
        <button type="submit" disabled={busy} className="min-h-[44px] w-full rounded-lg bg-tm-black font-semibold text-white disabled:opacity-60">
          {busy ? t("Verificando…", "Verifying…") : t("Ingresar", "Sign in")}
        </button>
      </form>
    </main>
  );
}
