import Link from "next/link";
import { FinSightLogo } from "@/components/brand/FinSightLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200">
      <header className="px-6 py-5 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3">
          <FinSightLogo variant="mark" theme="dark" height={32} />
          <span className="text-base font-bold tracking-tight text-white font-mono">
            FinSight
          </span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-emerald-400 font-mono uppercase tracking-widest">
              404 Error
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Page Not Found
            </h1>
            <p className="text-sm text-slate-400">
              The page you are looking for does not exist, has been removed, or is temporarily unavailable.
            </p>
          </div>

          <div>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 transition-all"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-600 font-mono">
        FinSight Financial Intelligence • 404 Not Found
      </footer>
    </div>
  );
}
