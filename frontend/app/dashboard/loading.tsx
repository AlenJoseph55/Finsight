export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#f7f8f6] text-slate-900 flex flex-col font-sans">
      {/* Top Navbar Placeholder */}
      <div className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-200 animate-pulse" />
          <div className="h-5 bg-slate-200 rounded w-24 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-100 animate-pulse" />
          <div className="w-8 h-8 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 animate-pulse">
          <div className="space-y-2">
            <div className="h-7 bg-slate-200 rounded w-44" />
            <div className="h-3.5 bg-slate-100 rounded w-64" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 bg-slate-200/70 rounded-xl w-36" />
            <div className="h-9 bg-slate-200/70 rounded-xl w-28" />
          </div>
        </div>

        {/* 4 Metric Cards Skeleton */}
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs bg-white border-t-2 border-t-slate-200"
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                <div className="h-3.5 bg-slate-200 rounded w-20" />
                <div className="w-7 h-7 rounded-xl bg-slate-100" />
              </div>
              <div className="h-7 bg-slate-200/80 rounded w-32 my-2.5" />
              <div className="h-3 bg-slate-100 rounded w-24" />
            </div>
          ))}
        </div>

        {/* Holdings Table Skeleton */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs animate-pulse">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100">
            <div className="space-y-2">
              <div className="h-5 bg-slate-200 rounded w-36" />
              <div className="h-3.5 bg-slate-100 rounded w-56" />
            </div>
            <div className="h-9 bg-slate-100 rounded-xl w-48" />
          </div>
          <div className="mt-5 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3.5 px-3 rounded-xl bg-slate-50/60 border border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="h-4 bg-slate-200 rounded w-36" />
                    <div className="h-3 bg-slate-100 rounded w-20" />
                  </div>
                </div>
                <div className="hidden sm:block space-y-1.5">
                  <div className="h-3.5 bg-slate-200 rounded w-24" />
                  <div className="h-3 bg-slate-100 rounded w-16" />
                </div>
                <div className="space-y-1.5 text-right">
                  <div className="h-4 bg-slate-200 rounded w-20 ml-auto" />
                  <div className="h-3 bg-slate-100 rounded w-14 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
