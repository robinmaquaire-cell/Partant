// Image de profil : la photo si elle existe, sinon les initiales du pseudo
// sur un fond coloré stable (la couleur découle du pseudo).

const COLORS = ["#2C7DA0", "#FF6B35", "#5A7D2C", "#7D2C6E", "#0F4C4C", "#C0533E"];

function initialsOf(pseudo: string): string {
  const words = pseudo.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function colorOf(pseudo: string): string {
  let h = 0;
  for (const c of pseudo) h = (h * 31 + c.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
}

export function Avatar({
  pseudo,
  url,
  size = 36,
}: {
  pseudo: string;
  url?: string | null;
  size?: number;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- photo externe (Supabase Storage), dimensions fixes
      <img
        src={url}
        alt={pseudo}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none"
      style={{
        width: size,
        height: size,
        background: colorOf(pseudo),
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initialsOf(pseudo)}
    </span>
  );
}
