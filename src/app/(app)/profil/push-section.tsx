"use client";

import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "./push-actions";

// Convertit la clé publique VAPID (texte) au format attendu par le navigateur.
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

type State =
  | "checking" // on regarde l'état de l'appareil
  | "unsupported" // navigateur trop ancien
  | "needs-install" // iPhone : il faut d'abord installer l'app
  | "off" // possible mais pas activé
  | "on" // activé sur cet appareil
  | "blocked"; // l'utilisateur a refusé dans les réglages du navigateur

export function PushSection({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Est-on dans l'app installée (mode « standalone ») ?
  const isStandalone = () =>
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // Safari iOS expose un indicateur maison.
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true);

  const isIos = () =>
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    let cancelled = false;
    // Détection asynchrone de l'état de l'appareil (support, permission,
    // abonnement déjà en place).
    (async () => {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported) {
        // Sur iPhone, l'API n'existe que dans l'app installée.
        if (!cancelled)
          setState(isIos() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setErr("");
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(vapidKey),
      });
      const json = sub.toJSON();
      const result = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      if (!result.ok) {
        setErr(result.error);
        await sub.unsubscribe().catch(() => {});
      } else {
        setState("on");
      }
    } catch {
      setErr("L'activation n'a pas abouti. Réessaie dans un instant.");
    }
    setBusy(false);
  };

  const disable = async () => {
    setErr("");
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
    } catch {
      setErr("La désactivation n'a pas abouti. Réessaie dans un instant.");
    }
    setBusy(false);
  };

  return (
    <div className="rounded-2xl p-4 mb-4 bg-card border-[1.5px] border-line">
      <h3 className="font-extrabold mb-1 font-display">
        🔔 Notifications sur ce téléphone
      </h3>

      {state === "checking" && (
        <p className="text-sm text-ink-soft">Vérification…</p>
      )}

      {state === "on" && (
        <>
          <p className="text-sm mb-3 text-ink-soft">
            Cet appareil reçoit les notifications : nouvel événement dans tes
            listes, rappel la veille.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={disable}
            className="px-4 py-2.5 rounded-xl font-bold text-refuse border-[1.5px] border-refuse/40 disabled:opacity-60"
          >
            {busy ? "Un instant…" : "Désactiver sur cet appareil"}
          </button>
        </>
      )}

      {state === "off" && (
        <>
          <p className="text-sm mb-3 text-ink-soft">
            Reçois une alerte directement sur ton téléphone quand un événement
            est proposé dans une de tes listes, ou la veille d&apos;un événement.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={enable}
            className="px-4 py-2.5 rounded-xl font-bold text-white bg-signal transition-transform active:scale-95 disabled:opacity-60"
          >
            {busy ? "Un instant…" : "Activer les notifications"}
          </button>
        </>
      )}

      {state === "needs-install" && (
        <p className="text-sm text-ink-soft">
          Sur iPhone, les notifications ne fonctionnent qu&apos;une fois
          l&apos;application ajoutée à l&apos;écran d&apos;accueil. Dans Safari :
          bouton <strong>Partager</strong> (le carré avec une flèche) →{" "}
          <strong>Sur l&apos;écran d&apos;accueil</strong>. Ouvre ensuite
          Partant ? depuis l&apos;icône, puis reviens ici pour activer.
        </p>
      )}

      {state === "blocked" && (
        <p className="text-sm text-refuse font-semibold">
          Les notifications sont bloquées pour Partant ? dans les réglages de ton
          navigateur. Réautorise-les là-bas, puis reviens activer ici.
        </p>
      )}

      {state === "unsupported" && (
        <p className="text-sm text-ink-soft">
          Ce navigateur ne gère pas les notifications. Installe Partant ? sur ton
          écran d&apos;accueil, ou utilise Chrome / Safari récent.
        </p>
      )}

      {err && <p className="text-sm font-semibold mt-2 text-refuse">{err}</p>}
    </div>
  );
}
