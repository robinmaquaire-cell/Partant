import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Géocodage inversé via Nominatim (OpenStreetMap), côté serveur pour
// respecter leur politique : 1 requête/seconde max et User-Agent identifiant
// l'application. https://operations.osmfoundation.org/policies/nominatim/

const USER_AGENT = "PartantApp/0.1 (+https://partant-six.vercel.app)";

// Espacement des appels (au mieux, par instance serveur).
let lastCallAt = 0;

type NominatimAddress = Record<string, string | undefined>;

function shortAddress(data: {
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
}): string | null {
  const a = data.address ?? {};
  const road =
    a.road || a.pedestrian || a.footway || a.path || a.square || a.hamlet || "";
  const city =
    a.village || a.town || a.city || a.municipality || a.county || "";
  const main = data.name || road;
  const parts = [main, city].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  if (data.display_name)
    return data.display_name.split(",").slice(0, 3).join(",").trim();
  return null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ address: null }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return NextResponse.json({ address: null }, { status: 400 });

  const wait = lastCallAt + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&accept-language=fr`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!res.ok) return NextResponse.json({ address: null });
    const data = await res.json();
    return NextResponse.json({ address: shortAddress(data) });
  } catch {
    return NextResponse.json({ address: null });
  }
}
