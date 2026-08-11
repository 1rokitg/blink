export function PlaceholderView({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[32px] font-semibold tracking-tight text-[#fafafa]">
        {title}
      </h1>
      <p className="mt-2 text-[14px] text-[#a1a1aa]">{description}</p>
      <div className="mt-8 rounded-2xl border border-dashed border-[#262626] bg-[#141414] px-6 py-16 text-center">
        <p className="text-[15px] font-medium text-[#e4e4e7]">Coming soon</p>
        <p className="mt-2 text-[13px] text-[#71717a]">
          This page is wired in the sidebar — backend hooks land next.
        </p>
      </div>
    </div>
  );
}
