const DAYS = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
const MONTHS = [
  "JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN",
  "JUIL", "AOÛT", "SEP", "OCT", "NOV", "DÉC",
];

// Le petit bloc calendrier (jour / numéro / mois) des cartes d'événements.
export function DateBlock({ date }: { date: string }) {
  const d = new Date(date + "T00:00");
  return (
    <div className="flex flex-col items-center justify-center rounded-xl px-3 py-2 shrink-0 bg-ink text-paper min-w-[58px]">
      <div className="text-xs font-bold opacity-70">{DAYS[d.getDay()]}</div>
      <div className="text-xl font-extrabold leading-none font-display">
        {d.getDate()}
      </div>
      <div className="text-xs font-bold opacity-70">{MONTHS[d.getMonth()]}</div>
    </div>
  );
}
