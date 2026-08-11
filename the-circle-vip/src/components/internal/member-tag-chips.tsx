import { memberTagTone } from "@/lib/member-tags";

export function MemberTagChips({
  tags,
  className = "",
}: {
  tags: string[] | null | undefined;
  className?: string;
}) {
  if (!tags?.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`.trim()}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${memberTagTone(tag)}`}
          title={tag}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
