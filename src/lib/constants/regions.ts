export interface Country {
  code: string;
  name: string;
}

export interface Region {
  id: string;
  name: string;
  countries: Country[];
}

export const REGIONS: Region[] = [
  {
    id: "north_america",
    name: "North America",
    countries: [
      { code: "US", name: "United States" },
      { code: "CA", name: "Canada" },
      { code: "MX", name: "Mexico" },
    ],
  },
  {
    id: "europe",
    name: "Europe",
    countries: [
      { code: "GB", name: "United Kingdom" },
      { code: "FR", name: "France" },
      { code: "DE", name: "Germany" },
      { code: "ES", name: "Spain" },
      { code: "IT", name: "Italy" },
      { code: "NL", name: "Netherlands" },
      { code: "EU_OTHER", name: "Other EU" },
    ],
  },
  {
    id: "west_africa",
    name: "West Africa",
    countries: [
      { code: "CI", name: "Cote d'Ivoire" },
      { code: "NG", name: "Nigeria" },
      { code: "GH", name: "Ghana" },
      { code: "SN", name: "Senegal" },
      { code: "CM", name: "Cameroon" },
      { code: "ML", name: "Mali" },
      { code: "BF", name: "Burkina Faso" },
      { code: "TG", name: "Togo" },
      { code: "BJ", name: "Benin" },
      { code: "GN", name: "Guinea" },
    ],
  },
  {
    id: "east_africa",
    name: "East Africa",
    countries: [
      { code: "KE", name: "Kenya" },
      { code: "TZ", name: "Tanzania" },
      { code: "UG", name: "Uganda" },
      { code: "RW", name: "Rwanda" },
      { code: "ET", name: "Ethiopia" },
      { code: "CD", name: "DRC Congo" },
    ],
  },
  {
    id: "south_africa_region",
    name: "Southern Africa",
    countries: [
      { code: "ZA", name: "South Africa" },
      { code: "ZW", name: "Zimbabwe" },
      { code: "MZ", name: "Mozambique" },
      { code: "BW", name: "Botswana" },
      { code: "NA", name: "Namibia" },
    ],
  },
  {
    id: "middle_east",
    name: "Middle East & North Africa",
    countries: [
      { code: "AE", name: "UAE" },
      { code: "SA", name: "Saudi Arabia" },
      { code: "EG", name: "Egypt" },
      { code: "MA", name: "Morocco" },
      { code: "TN", name: "Tunisia" },
      { code: "QA", name: "Qatar" },
      { code: "KW", name: "Kuwait" },
    ],
  },
  {
    id: "asia_pacific",
    name: "Asia Pacific",
    countries: [
      { code: "IN", name: "India" },
      { code: "PH", name: "Philippines" },
      { code: "ID", name: "Indonesia" },
      { code: "TH", name: "Thailand" },
      { code: "VN", name: "Vietnam" },
      { code: "MY", name: "Malaysia" },
      { code: "SG", name: "Singapore" },
      { code: "JP", name: "Japan" },
      { code: "AU", name: "Australia" },
    ],
  },
  {
    id: "caribbean_latam",
    name: "Caribbean & Latin America",
    countries: [
      { code: "HT", name: "Haiti" },
      { code: "JM", name: "Jamaica" },
      { code: "TT", name: "Trinidad" },
      { code: "DO", name: "Dominican Republic" },
      { code: "BR", name: "Brazil" },
      { code: "CO", name: "Colombia" },
      { code: "LATAM_OTHER", name: "Other Caribbean/LATAM" },
    ],
  },
];

export const ALL_COUNTRIES = REGIONS.flatMap((r) =>
  r.countries.map((c) => ({ ...c, regionId: r.id, regionName: r.name }))
);

export function getRegionForCountry(countryCode: string): string | null {
  const region = REGIONS.find((r) =>
    r.countries.some((c) => c.code === countryCode)
  );
  return region?.id || null;
}

export function getRegionName(regionId: string): string {
  return REGIONS.find((r) => r.id === regionId)?.name || regionId;
}

export function getCountryName(countryCode: string): string {
  for (const region of REGIONS) {
    const country = region.countries.find((c) => c.code === countryCode);
    if (country) return country.name;
  }
  return countryCode;
}
