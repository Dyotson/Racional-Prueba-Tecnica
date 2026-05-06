export function SkeletonChart() {
  return (
    <div className="space-y-4">
      <div className="card p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 space-y-3">
            <div className="skeleton h-3 w-32" />
            <div className="skeleton h-10 w-56" />
            <div className="skeleton h-5 w-40" />
          </div>
          <div className="skeleton h-20 w-full md:w-60 rounded-xl" />
        </div>
      </div>
      <div className="card p-4 md:p-6">
        <div className="skeleton h-4 w-24 mb-4" />
        <div className="skeleton h-[320px] md:h-[420px] w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-4 space-y-2">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-6 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
