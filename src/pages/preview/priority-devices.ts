// Device library entries without a mockup frame (plain frame is used).
// Fixed-orientation entries store their portrait size in width/height; `orientation` flips it for display.

export type LibraryDevice = {
  name: string;
  width: number;
  height: number;
  type: 'phone' | 'tablet';
  group: string;
  // Optional sub-heading inside the group.
  subgroup?: string;
  orientation?: 'portrait' | 'landscape';
};

export const PRIORITY_GROUP = 'Priority';
export const GOOGLE_ADS_SUBGROUP = 'Google Ads';
export const STANDARD_SUBGROUP = 'Standard';

export const PRIORITY_DEVICES: LibraryDevice[] = [
  { name: 'Phone (Classic Base) - Portrait', width: 320, height: 480, type: 'phone', group: PRIORITY_GROUP, subgroup: GOOGLE_ADS_SUBGROUP, orientation: 'portrait' },
  { name: 'Phone (Classic Base) - Landscape', width: 320, height: 480, type: 'phone', group: PRIORITY_GROUP, subgroup: GOOGLE_ADS_SUBGROUP, orientation: 'landscape' },
  { name: 'Phone (Modern Tall) - Portrait', width: 390, height: 884, type: 'phone', group: PRIORITY_GROUP, subgroup: GOOGLE_ADS_SUBGROUP, orientation: 'portrait' },
  { name: 'Phone (Modern Wide) - Landscape', width: 390, height: 884, type: 'phone', group: PRIORITY_GROUP, subgroup: GOOGLE_ADS_SUBGROUP, orientation: 'landscape' },
  { name: 'Tablet (Standard) - Portrait', width: 768, height: 1024, type: 'tablet', group: PRIORITY_GROUP, subgroup: GOOGLE_ADS_SUBGROUP, orientation: 'portrait' },
  { name: 'Tablet (Standard) - Landscape', width: 768, height: 1024, type: 'tablet', group: PRIORITY_GROUP, subgroup: GOOGLE_ADS_SUBGROUP, orientation: 'landscape' },
  // Common CSS viewports per resolution class (HD, FHD, FHD+ ...), portrait.
  { name: 'HD / FHD 16:9 (DPR 2-3)', width: 360, height: 640, type: 'phone', group: PRIORITY_GROUP, subgroup: STANDARD_SUBGROUP, orientation: 'portrait' },
  { name: 'HD+ 20:9 (DPR 2)', width: 360, height: 800, type: 'phone', group: PRIORITY_GROUP, subgroup: STANDARD_SUBGROUP, orientation: 'portrait' },
  { name: 'FHD 16:9 (DPR 2.625)', width: 412, height: 732, type: 'phone', group: PRIORITY_GROUP, subgroup: STANDARD_SUBGROUP, orientation: 'portrait' },
  { name: 'FHD+ 19.5:9 (DPR 3)', width: 360, height: 780, type: 'phone', group: PRIORITY_GROUP, subgroup: STANDARD_SUBGROUP, orientation: 'portrait' },
  { name: 'FHD+ 19.5:9 (DPR 2.81)', width: 384, height: 832, type: 'phone', group: PRIORITY_GROUP, subgroup: STANDARD_SUBGROUP, orientation: 'portrait' },
  { name: 'FHD+ 20:9 (DPR 2.75)', width: 393, height: 873, type: 'phone', group: PRIORITY_GROUP, subgroup: STANDARD_SUBGROUP, orientation: 'portrait' },
  { name: 'FHD+ / QHD+ 20:9 (DPR 2.625-3.75)', width: 412, height: 915, type: 'phone', group: PRIORITY_GROUP, subgroup: STANDARD_SUBGROUP, orientation: 'portrait' },
];

type SizedDevice = { name: string; mockup?: unknown; width?: number; height?: number; orientation?: 'portrait' | 'landscape' };

const sizeKey = (d: SizedDevice) => {
  const w = d.width || 0;
  const h = d.height || 0;
  return d.orientation === 'landscape' ? `${h}x${w}` : `${w}x${h}`;
};

/**
 * Concatenates device lists in priority order, dropping any entry whose name or
 * displayed size (frameless entries only) was already seen.
 */
export function mergeDevices<T extends SizedDevice>(...lists: T[][]): T[] {
  const names = new Set<string>();
  const sizes = new Set<string>();
  const out: T[] = [];
  for (const device of lists.flat()) {
    const name = device.name.trim().toLowerCase();
    const size = sizeKey(device);
    // Real devices with a mockup are distinct products and may share a size; only frameless entries dedupe by size.
    const bySize = !device.mockup;
    if (names.has(name) || (bySize && sizes.has(size))) {
      continue;
    }
    names.add(name);
    if (bySize) {
      sizes.add(size);
    }
    out.push(device);
  }
  return out;
}
