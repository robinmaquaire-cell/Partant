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
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            map.setView(
              { lat: pos.coords.latitude, lng: pos.coords.longitude },
              15
            );
            setStatus("Touche la carte pour placer le point de rendez-vous.");
          },
          () => {
            if (cancelled) return;
            setStatus(
              "Localisation refusée — zoome sur la carte pour placer le point."
            );
          },
          { timeout: 6000 }
        );
      } else {
        setStatus("Zoome sur la carte pour placer le point de rendez-vous.");
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
        {status}
        {address && (
          <div className="font-semibold text-ink mt-0.5">📍 {address}</div>
        )}
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
