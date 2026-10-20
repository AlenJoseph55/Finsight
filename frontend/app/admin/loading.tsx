export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[#f7f8f6] text-slate-900 flex flex-col font-sans">
      {/* Admin TopBar Skeleton */}
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-200 animate-pulse" />
          <div className="h-5 bg-slate-200 rounded w-32 animate-pulse" />
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-6 bg-slate-200 rounded w-48" />
          <div className="h-3.5 bg-slate-100 rounded w-72" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="h-3.5 bg-slate-200 rounded w-24 mb-3" />
              <div className="h-7 bg-slate-200 rounded w-32 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-20" />
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs h-72" />
      </main>
    </div>
  );
}
