import type { Validator, ValidationResult, ValidationCategory } from './types';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/**
 * Pre-checks a playable against Unity Ads requirements: a single HTML file of at
 * most 5MB, MRAID-based (Unity accepts MRAID from 2025), with iOS store links on
 * the apps.apple.com domain. The official check is Unity's test app.
 */
export class UnityValidator implements Validator {
  validate(content: string, fileSize: number, _context?: unknown): ValidationResult {
    const hasDoctype = /<!DOCTYPE html>/i.test(content);
    const hasMraid = content.includes('mraid');
    const usesLegacyAppleStore = /itunes\.apple\.com/i.test(content);

    const categories: ValidationCategory[] = [
      {
        name: 'Unity Ads',
        checks: [
          {
            name: `HTML file size <= ${MAX_SIZE_MB}MB`,
            passed: fileSize <= MAX_SIZE_BYTES,
            details: `File size: ${(fileSize / (1024 * 1024)).toFixed(1)}MB${
              fileSize > MAX_SIZE_BYTES ? ` (max: ${MAX_SIZE_MB}MB)` : ''
            }`,
          },
          {
            name: 'Valid HTML5 doctype',
            passed: hasDoctype,
            details: !hasDoctype
              ? 'Missing HTML5 doctype declaration'
              : undefined,
          },
          {
            name: 'MRAID environment used',
            passed: hasMraid,
            isWarning: !hasMraid,
            details: !hasMraid
              ? 'No mraid reference found. Unity accepts MRAID builds, so the creative should integrate with mraid.'
              : undefined,
          },
          {
            name: 'iOS store links use apps.apple.com',
            passed: !usesLegacyAppleStore,
            isWarning: usesLegacyAppleStore,
            details: usesLegacyAppleStore
              ? 'itunes.apple.com link detected. Unity requires iOS store links on the apps.apple.com domain.'
              : undefined,
          },
          {
            name: 'Test in Unity test app',
            passed: true,
            isWarning: true,
            details: 'Final check: paste the playable URL into the Unity test app and review the Creative report.',
          },
        ],
      },
    ];

    return { categories };
  }
}
