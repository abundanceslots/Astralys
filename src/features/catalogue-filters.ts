export type SkyRegion =
  | 'all'
  | 'north-polar'
  | 'north-high'
  | 'north-low'
  | 'equatorial'
  | 'south-low'
  | 'south-high'
  | 'south-polar';

export type StarSort = 'nearest' | 'farthest' | 'brightness' | 'name';

export type SkyRegionOption = {
  value: SkyRegion;
  label: string;
  description: string;
  minimumDeclination?: number;
  maximumDeclination?: number;
};

export const defaultStarSort: StarSort = 'nearest';

// The upper edge is exclusive. The final north-polar band has no upper edge.
// Together these bands cover every valid declination exactly once.
export const regionOptions: readonly SkyRegionOption[] = [
  { value: 'all', label: 'All sky', description: 'Every declination' },
  { value: 'north-polar', label: 'North pole', description: '+60° to +90°', minimumDeclination: 60 },
  { value: 'north-high', label: 'High north', description: '+30° to +60°', minimumDeclination: 30, maximumDeclination: 60 },
  { value: 'north-low', label: 'Low north', description: '+10° to +30°', minimumDeclination: 10, maximumDeclination: 30 },
  { value: 'equatorial', label: 'Equatorial', description: '−10° to +10°', minimumDeclination: -10, maximumDeclination: 10 },
  { value: 'south-low', label: 'Low south', description: '−30° to −10°', minimumDeclination: -30, maximumDeclination: -10 },
  { value: 'south-high', label: 'High south', description: '−60° to −30°', minimumDeclination: -60, maximumDeclination: -30 },
  { value: 'south-polar', label: 'South pole', description: '−90° to −60°', maximumDeclination: -60 },
] as const;

export const sortOptions: readonly { value: StarSort; label: string; column: string; ascending: boolean }[] = [
  { value: 'nearest', label: 'Nearest first', column: 'distance_ly', ascending: true },
  { value: 'farthest', label: 'Farthest first', column: 'distance_ly', ascending: false },
  { value: 'brightness', label: 'Brightest first', column: 'apparent_magnitude', ascending: true },
  { value: 'name', label: 'Name A–Z', column: 'scientific_name', ascending: true },
] as const;

export function getSkyRegionOption(region: SkyRegion): SkyRegionOption {
  return regionOptions.find((option) => option.value === region) ?? regionOptions[0];
}

