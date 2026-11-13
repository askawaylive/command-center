import type { Business } from "@/lib/types";

/** A business's logo, or a soft colored tile with its initial when there is no logo. */
export function BizMark({ business, size = 20 }: { business: Pick<Business, "name" | "color" | "logo">; size?: number }) {
  const r = Math.round(size * 0.28);
  if (business.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={business.logo} alt="" width={size} height={size} className="shrink-0 object-cover" style={{ borderRadius: r, width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center font-medium text-white"
      style={{ width: size, height: size, borderRadius: r, background: business.color, fontSize: Math.round(size * 0.5) }}
    >
      {business.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
