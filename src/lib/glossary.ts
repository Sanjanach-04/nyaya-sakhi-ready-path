/** Small legal-literacy glossary used for tooltips in the Rights pages.
 *  Definitions are general explanations of common legal terms, not legal
 *  advice; the original term is always kept next to the explanation. */
export interface GlossaryEntry {
  term: string;
  short: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: "FIR", short: "First Information Report — the first record the police write when a serious offence is reported." },
  { term: "cognizable offence", short: "A serious offence where police can register a case and investigate without prior court permission." },
  { term: "non-cognizable offence", short: "A less serious offence where the police need court permission before investigating." },
  { term: "bail", short: "Release from custody, usually with conditions, while the case continues." },
  { term: "anticipatory bail", short: "Court protection from arrest sought in advance for a bailable case." },
  { term: "maintenance", short: "Regular financial support a court can order a spouse, parent or child to receive." },
  { term: "interim order", short: "A temporary court order that stays in force until the case is decided." },
  { term: "protection order", short: "A court order that stops an abusive person from committing further violence." },
  { term: "residence order", short: "A court order about who may live in the shared household." },
  { term: "Protection Officer", short: "A government officer who helps aggrieved persons under the domestic violence law." },
  { term: "aggrieved person", short: "The person who suffers the domestic violence; the law uses this term." },
  { term: "dower", short: "See 'dowry' — property or money given in connection with a marriage." },
  { term: "dowry", short: "Property or money given in connection with a marriage; demanding it is punishable." },
  { term: "presumption", short: "Something the court assumes to be true unless the other side proves otherwise." },
  { term: "limitation period", short: "The time limit within which a case or application must be filed." },
  { term: "summon", short: "An official order to appear before a court or authority." },
  { term: "warrant", short: "A written court order authorising the police to act, such as an arrest or search." },
  { term: "lok adalat", short: "A People's Court that settles disputes through compromise without lengthy litigation." },
  { term: "free legal aid", short: "Free legal help provided by legal services authorities to eligible persons, including women." },
];
