export default function ListesDiffusionPage() {
  return (
    <div className="pb-8">
      <h2 className="text-xl font-extrabold mb-1 font-display">
        Listes de diffusion
      </h2>
      <p className="text-sm mb-6 text-ink-soft">
        Regroupe des contacts pour leur diffuser des événements sans partager la
        liste elle-même. Chacun reçoit l&apos;invitation à titre personnel.
      </p>

      <div className="rounded-2xl p-6 text-center bg-card border-[1.5px] border-line">
        <div className="text-3xl mb-2">📣</div>
        <div className="font-bold text-ink mb-1">Bientôt disponible</div>
        <p className="text-sm text-ink-soft">
          Cette section arrive prochainement. En attendant, tu peux créer des
          groupes ou inviter contact par contact depuis le formulaire
          d&apos;événement.
        </p>
      </div>
    </div>
  );
}
