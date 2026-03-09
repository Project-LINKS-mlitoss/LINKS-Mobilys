// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
/**
 * items: [{ coordinates: [lon, lat], label: string, ... }]
 * returns: same items + {_offset: [dx, dy]} in **pixels**
 */
export function spreadLabelOffsets(
  items,
  {
    precision = 6,     // how tightly to bucket "same point"
    baseRadiusPx = 10, // radius of first ring
    stepPx = 6,        // extra radius per ring
    perRing = 8,       // items per ring (8 = every 45deg)
    sortKey,           // optional: (item) => string|number for deterministic ordering
  } = {}
) {
  const buckets = new Map();

  for (const it of items) {
    const [lon, lat] = (it.coordinates || [0, 0]);
    const key = `${lat.toFixed(precision)},${lon.toFixed(precision)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(it);
  }

  const out = [];

  for (const group of buckets.values()) {
    if (group.length === 1) {
      out.push({ ...group[0], _offset: [0, 0] });
      continue;
    }

    // deterministic order so offsets don’t shuffle between renders
    group.sort((a, b) => {
      if (sortKey) {
        const ak = sortKey(a), bk = sortKey(b);
        return ak < bk ? -1 : ak > bk ? 1 : 0;
      }
      return String(a.label).localeCompare(String(b.label));
    });

    for (let i = 0; i < group.length; i++) {
      const ring = Math.floor(i / perRing);
      const slot = i % perRing;

      const radius = baseRadiusPx + ring * stepPx;
      const theta = (2 * Math.PI * slot) / perRing;

      const dx = Math.round(radius * Math.cos(theta));
      const dy = Math.round(radius * Math.sin(theta));

      out.push({ ...group[i], _offset: [dx, dy] });
    }
  }

  return out;
}
