"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

type Coords = { lat: number; lng: number };

// Vue par défaut : la France entière, si la géolocalisation est refusée.
const FRANCE: Coords = { lat: 46.6, lng: 2.4 };

export function GpsMap({
  initial,
  onPick,
  onClose,
}: {
  initial: Coords | null;
  // Appelé à chaque pointage : coordonnées + adresse trouvée (ou null).
  onPick: (coords: Coords, address: string | null) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [status, setStatus] = useState(
    initial ? "Touche la carte pour déplacer le point." : "Recherche de ta position…"
  );
  const [address, setAddress] = useState("");
  const [locating, setLocating] = useState(false);

  // Centrer la carte sur la position du téléphone. Relançable à la demande :
  // sur mobile, l'autorisation arrive souvent après le premier essai.
  const locate = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!navigator.geolocation) {
      setStatus(
        "Ton navigateur ne sait pas te localiser — déplace la carte à la main pour placer le point."
      );
      return;
    }
    setLocating(true);
    setStatus("Recherche de ta position…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        map.setView(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          15
        );
        setStatus("Touche la carte pour placer le point de rendez-vous.");
      },
      (err) => {
        setLocating(false);
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? "Localisation refusée. Autorise-la pour ce site dans les réglages de ton téléphone, puis appuie sur « Me localiser »."
            : err.code === err.TIMEOUT
              ? "Ta position met trop de temps à arriver (signal faible ?). Appuie sur « Me localiser » pour réessayer, ou déplace la carte à la main."
              : "Position indisponible pour l'instant. Appuie sur « Me localiser » pour réessayer, ou déplace la carte à la main."
        );
      },
      // 15 s : un premier point GPS est lent à obtenir en extérieur.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: initial ?? FRANCE,
        zoom: initial ? 15 : 5,
      });
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      // Épingle « gilet de sauvetage » : un simple emoji, aucun fichier image.
      const pin = L.divIcon({
        className: "",
        html: '<div style="font-size:28px;line-height:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">📍</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 26],
      });

      const place = async (coords: Coords) => {
        const rounded = {
          lat: +coords.lat.toFixed(5),
          lng: +coords.lng.toFixed(5),
        };
        if (markerRef.current) markerRef.current.setLatLng(rounded);
        else markerRef.current = L.marker(rounded, { icon: pin }).addTo(map);
        setStatus("Point placé ✓ — touche ailleurs pour le déplacer.");
        setAddress("Recherche de l'adresse…");
        let found: string | null = null;
        try {
          const res = await fetch(
            `/api/geocode-inverse?lat=${rounded.lat}&lng=${rounded.lng}`
          );
          if (res.ok) found = (await res.json()).address ?? null;
        } catch {
          // Pas d'adresse trouvée : le point GPS suffit.
        }
        setAddress(found ?? "Adresse non trouvée (le point GPS suffit).");
        onPick(rounded, found);
      };

      map.on("click", (e) => place(e.latlng));

      if (initial) {
        markerRef.current = L.marker(initial, { icon: pin }).addTo(map);
      } else {
        locate();
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Le composant est monté/démonté à l'ouverture : pas de re-création à chaud.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl overflow-hidden border-[1.5px] border-line bg-card">
      <div ref={containerRef} className="h-72 w-full" />
      <div className="px-3 py-2 text-xs text-ink-soft">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            {status}
            {address && (
              <div className="font-semibold text-ink mt-0.5">📍 {address}</div>
            )}
          </div>
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold text-pine border-[1.5px] border-pine disabled:opacity-50"
          >
            {locating ? "…" : "Me localiser"}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full py-2.5 font-bold text-sm bg-ink text-paper"
      >
        C&apos;est bon ✓
      </button>
    </div>
  );
}
