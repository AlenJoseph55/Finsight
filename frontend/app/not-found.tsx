import Link from "next/link";
import { FinSightLogo } from "@/components/brand/FinSightLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f7f8f6] text-slate-900 flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-900">
      <header className="px-6 py-5 flex items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-3">
          <FinSightLogo variant="mark" theme="light" height={32} />
          <span className="text-base font-bold tracking-tight text-slate-900 font-mono">
            FinSight
          </span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-3">
            <span className="text-xs font-bold text-emerald-800 font-mono uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 inline-block">
              404 • Not Found
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-serif-editorial">
              Page Not Found
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
              The page you are looking for does not exist, has been removed, or requires administrative permissions.
            </p>
          </div>

          <div>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 font-mono border-t border-slate-200/60">
        FinSight Financial Intelligence • 404 Not Found
      </footer>
    </div>
  );
}
