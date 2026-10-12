/* 3.29 — the small line icons a row of details can carry: the contact card's
   rows and a job's details. Names, so the editor can offer them as a list; the
   drawings are in components/site/InfoIcon.tsx. */
export const INFO_ICONS = ['pin', 'phone', 'mail', 'clock', 'calendar', 'globe', 'briefcase', 'document', 'people'] as const;
export type InfoIconName = (typeof INFO_ICONS)[number];

export const INFO_ICON_LABELS: Record<InfoIconName, string> = {
  pin: 'A map pin — an address',
  phone: 'A telephone',
  mail: 'An envelope — email',
  clock: 'A clock — hours, working time',
  calendar: 'A calendar — days, dates',
  globe: 'A globe — a website, languages',
  briefcase: 'A briefcase — a role, a level',
  document: 'A page — a contract, a document',
  people: 'People — a team, a department',
};
