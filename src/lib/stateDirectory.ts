// Builds the full list of states that should get a page — every state with a
// curated cities.json entry, unioned with every state that has at least one
// providers.json entry, even if it has zero curated cities. Used by the
// top-level directory, the state hub's getStaticPaths, and the city page's
// getStaticPaths, so all three stay in sync instead of each independently
// iterating citiesData.states (which silently drops any state with real
// provider coverage but no curated cities).

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', PR: 'Puerto Rico', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

// No per-state BHRT pricing research exists for states outside the curated
// cities.json list — this is a national-average placeholder (derived from the
// curated states' own ranges), not researched data. Flagged here so it's easy
// to find and replace if real per-state figures are sourced later.
const DEFAULT_COST_RANGE = '$300–$600';

export interface StateEntry {
  name: string;
  abbr: string;
  slug: string;
  costRange: string;
  /** True when costRange is the DEFAULT_COST_RANGE national-average fallback
   *  rather than state-specific researched data — pages must disclose this
   *  to the reader, not just to future maintainers reading the source. */
  isCostEstimated: boolean;
  cities: Array<{
    name: string;
    slug: string;
    tier: 'primary' | 'secondary';
    related: Array<{ stateSlug: string; stateName: string; abbr: string; citySlug: string; cityName: string }>;
  }>;
}

interface Provider {
  stateCode: string;
  [key: string]: unknown;
}

export function getAllStates(citiesData: { states: StateEntry[] }, providersData: Provider[]): StateEntry[] {
  const curatedByAbbr = new Map(citiesData.states.map((s) => [s.abbr, s]));
  const allAbbrs = new Set<string>([...curatedByAbbr.keys(), ...providersData.map((p) => p.stateCode)]);

  const result: StateEntry[] = [];
  for (const abbr of allAbbrs) {
    const curated = curatedByAbbr.get(abbr);
    if (curated) {
      result.push({ ...curated, isCostEstimated: false });
    } else {
      const name = STATE_NAMES[abbr] ?? abbr;
      result.push({ name, abbr, slug: toSlug(name), costRange: DEFAULT_COST_RANGE, isCostEstimated: true, cities: [] });
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}
