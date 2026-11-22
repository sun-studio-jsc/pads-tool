import type { Validator, ValidationResult, ValidationCategory } from './types';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/**
 * Pre-checks a playable against Google Ads (Display/Asset) requirements:
 * a ZIP package of at most 5MB with an HTML5 entry point.
 * The official check is Google's H5 Validator, which the report links to.
 */
export class GoogleAdsValidator implements Validator {
  validate(content: string, fileSize: number, _context?: unknown): ValidationResult {
    const hasDoctype = /<!DOCTYPE html>/i.test(content);

    const categories: ValidationCategory[] = [
      {
        name: 'Google Ads',
        checks: [
          {
            name: `Package size <= ${MAX_SIZE_MB}MB`,
            passed: fileSize <= MAX_SIZE_BYTES,
            details: `Package size: ${(fileSize / (1024 * 1024)).toFixed(1)}MB${
              fileSize > MAX_SIZE_BYTES ? ` (max: ${MAX_SIZE_MB}MB)` : ''
            }`,
          },
          {
            name: 'Valid HTML5 doctype in entry file',
            passed: hasDoctype,
            details: !hasDoctype
              ? 'Missing HTML5 doctype declaration. Google Ads runs the ZIP entry HTML, so the entry file needs <!DOCTYPE html>.'
              : undefined,
          },
          {
            name: 'Validate with Google H5 Validator',
            passed: true,
            isWarning: true,
            details: 'Final check: https://h5validator.appspot.com/adwords/asset',
          },
        ],
      },
    ];

    return { categories };
  }
}
