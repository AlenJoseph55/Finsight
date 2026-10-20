import { FinSightLogo } from "@/components/brand/FinSightLogo";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f7f8f6] flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 text-center animate-in fade-in duration-200">
        <FinSightLogo variant="mark" theme="light" height={44} />
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce" />
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">
          Loading FinSight...
        </p>
      </div>
    </div>
  );
}
