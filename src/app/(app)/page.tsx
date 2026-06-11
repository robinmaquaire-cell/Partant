export default function EvenementsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold font-display">À venir</h2>
      </div>
      <div className="text-center py-12 text-ink-soft">
        Aucun événement pour l&apos;instant.
      </div>
      <p className="text-xs mt-4 text-center text-ink-soft">
        🚧 La création d&apos;événements arrive au jalon 3 du chantier.
      </p>
    </div>
  );
}
