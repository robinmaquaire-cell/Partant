// Typage minimal pour ical-expander (le paquet n'en fournit pas).
declare module "ical-expander" {
  type IcalTime = { toJSDate(): Date };
  type IcalEntry = { startDate: IcalTime; endDate: IcalTime };
  export default class IcalExpander {
    constructor(opts: { ics: string; maxIterations?: number });
    between(
      after: Date,
      before: Date
    ): { events: IcalEntry[]; occurrences: IcalEntry[] };
  }
}
