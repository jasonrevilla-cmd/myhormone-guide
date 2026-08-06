// Builds the unified per-state city list used by both the state hub page
// (find-bhrt-provider/[state]/index.astro) and the city page's getStaticPaths
// (find-bhrt-provider/[state]/[city]/index.astro). A "city" here can come from
// two sources — a curated cities.json entry, or a city discovered purely from
// providers.json — and the two are merged into one list so both templates stay
// in sync instead of computing this independently and drifting.

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Groups city-name spelling variants together (e.g. "Winston Salem" vs.
// "Winston-Salem") that would otherwise slugify to the same URL and collide
// in getStaticPaths, silently dropping one variant's providers from the
// built page. Treats hyphens and whitespace as interchangeable separators
// so both spellings resolve to one discovered-city group.
export function normalizeCityKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, ' ');
}

interface CuratedCity {
  name: string;
  slug: string;
  tier: 'primary' | 'secondary';
  related: Array<{ stateSlug: string; stateName: string; abbr: string; citySlug: string; cityName: string }>;
}

interface CuratedState {
  abbr: string;
  cities: CuratedCity[];
}

interface Provider {
  slug: string;
  practiceName: string;
  city: string;
  stateCode: string;
  [key: string]: unknown;
}

export interface CityDirectoryEntry {
  name: string;
  slug: string;
  tier: 'primary' | 'secondary';
  related: CuratedCity['related'];
  providerCount: number;
  isCurated: boolean;
  /** 'city-page' -> links to /find-bhrt-provider/{state}/{slug}/, a real page exists.
   *  'provider'  -> links straight to /provider/{providerSlug}/, no city page exists. */
  linkType: 'city-page' | 'provider';
  providerSlug?: string;
}

/**
 * Returns every city for a state that should appear somewhere in the
 * find-a-provider UI: curated cities (always included, even with 0
 * providers) plus any city discovered purely from providers.json. Sorted
 * alphabetically, with 0-provider cities pushed to the end.
 */
export function getStateCityDirectory(state: CuratedState, providersData: Provider[]): CityDirectoryEntry[] {
  const curatedByKey = new Map(state.cities.map((c) => [normalizeCityKey(c.name), c]));

  const discovered = new Map<string, { name: string; providers: Provider[] }>();
  for (const provider of providersData) {
    if (provider.stateCode !== state.abbr) continue;
    const key = normalizeCityKey(provider.city);
    if (!key) continue;
    if (!discovered.has(key)) discovered.set(key, { name: provider.city.trim(), providers: [] });
    discovered.get(key)!.providers.push(provider);
  }

  const allKeys = new Set([...curatedByKey.keys(), ...discovered.keys()]);

  const entries: CityDirectoryEntry[] = [];
  for (const key of allKeys) {
    const curated = curatedByKey.get(key);
    const group = discovered.get(key);
    const providerCount = group ? group.providers.length : 0;
    const name = curated ? curated.name : group!.name;

    const entry: CityDirectoryEntry = {
      name,
      slug: curated ? curated.slug : toSlug(name),
      tier: curated ? curated.tier : 'secondary',
      related: curated ? curated.related : [],
      providerCount,
      isCurated: !!curated,
      linkType: providerCount === 1 ? 'provider' : 'city-page',
      providerSlug: providerCount === 1 ? group!.providers[0].slug : undefined,
    };
    entries.push(entry);
  }

  entries.sort((a, b) => {
    const aZero = a.providerCount === 0 ? 1 : 0;
    const bZero = b.providerCount === 0 ? 1 : 0;
    if (aZero !== bZero) return aZero - bZero;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

/** The subset of a state's city directory that needs its own generated page:
 *  curated cities (always, even at 0 providers) and any discovered city with
 *  2+ providers. Cities with exactly 1 provider link straight to that
 *  provider's page instead and don't get a page of their own. */
export function getCityPageEntries(state: CuratedState, providersData: Provider[]): CityDirectoryEntry[] {
  return getStateCityDirectory(state, providersData).filter(
    (entry) => entry.isCurated || entry.providerCount >= 2
  );
}
