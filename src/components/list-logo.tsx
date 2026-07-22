// Logo d'une liste de diffusion : l'image envoyée si elle existe,
// sinon l'emoji choisi sur fond coloré, sinon la pastille de couleur seule.

export type ListLogoData = {
  name: string;
  color: string;
  emoji?: string | null;
  logoUrl?: string | null;
};

export function ListLogo({
  list,
  size = 36,
  onColor = false,
}: {
  list: ListLogoData;
  size?: number;
  onColor?: boolean; // posé sur un fond déjà à la couleur de la liste
}) {
  const radius = Math.round(size * 0.28);

  if (list.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- image externe (Supabase Storage), dimensions fixes
      <img
        src={list.logoUrl}
        alt={list.name}
        width={size}
        height={size}
        className="object-cover shrink-0"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex items-center justify-center shrink-0 select-none leading-none"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: onColor ? "rgba(255,255,255,0.22)" : list.color,
        fontSize: Math.round(size * 0.55),
      }}
    >
      {list.emoji ?? ""}
    </span>
  );
}
