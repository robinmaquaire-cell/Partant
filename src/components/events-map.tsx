"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { EventCardData } from "./event-card";

const FRANCE = { lat: 46.6, lng: 2.4 };

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Carte des événements géolocalisés : une épingle par lieu, couleur de la
// (première) liste, clic → fiche de l'événement.
export function EventsMap({ events }: { events: EventCardData[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const located = events.filter((e) => e.lat !== null && e.lng !== null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { center: FRANCE, zoom: 5 });
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const latlngs: [number, number][] = [];
      for (const e of located) {
        const color = e.lists[0]?.color || "#2C7DA0";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 20],
        });
        const date = new Date(e.event_date + "T00:00").toLocaleDateString(
          "fr-FR",
          { weekday: "short", day: "numeric", month: "short" }
        );
        const marker = L.marker([e.lat as number, e.lng as number], {
          icon,
        }).addTo(map);
        marker.bindPopup(
          `<div style="font-family:system-ui;min-width:140px">
            <strong>${escapeHtml(e.title)}</strong><br>
            <span style="color:#3D5A55">${date} · ${e.event_time.slice(0, 5)}</span><br>
            ${e.location_text ? `<span style="color:#3D5A55">📍 ${escapeHtml(e.location_text)}</span><br>` : ""}
            <a href="/evenements/${e.id}" style="color:#2C7DA0;font-weight:700;text-decoration:none">Voir l'événement ›</a>
          </div>`
        );
        latlngs.push([e.lat as number, e.lng as number]);
      }

      if (latlngs.length === 1) {
        map.setView(latlngs[0], 13);
      } else if (latlngs.length > 1) {
        map.fitBounds(latlngs, { padding: [40, 40] });
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Carte reconstruite quand la liste des événements localisés change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [located.map((e) => e.id).join(",")]);

  return (
    <div>
      <div className="rounded-2xl overflow-hidden border-[1.5px] border-line">
        <div ref={containerRef} className="h-[380px] w-full" />
      </div>
      {located.length === 0 && (
        <p className="text-sm text-center mt-2 text-ink-soft">
          Aucun événement géolocalisé pour l&apos;instant. Ajoute un point GPS à
          un événement pour le voir apparaître ici.
        </p>
      )}
      {located.length > 0 && located.length < events.length && (
        <p className="text-xs text-center mt-2 text-ink-soft">
          {events.length - located.length} événement
          {events.length - located.length > 1 ? "s" : ""} sans point GPS
          {events.length - located.length > 1 ? " n'apparaissent" : " n'apparaît"}{" "}
          pas sur la carte.
        </p>
      )}
    </div>
  );
}
