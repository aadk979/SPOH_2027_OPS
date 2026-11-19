/** Red "SoC" square used in the app bar (DS-1: swap for the official logo when provided). */
export function BrandMark() {
  return (
    <span
      aria-hidden
      className="inline-grid h-6 w-6 place-items-center rounded-[7px] bg-accent font-mono text-[10px] font-extrabold text-on-accent"
    >
      SoC
    </span>
  );
}
