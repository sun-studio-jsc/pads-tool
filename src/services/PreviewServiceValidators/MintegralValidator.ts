import type { Validator, ValidationResult, ValidationCategory } from './types';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/**
 * Pre-checks a playable against Mintegral requirements: a ZIP package of at most
 * 5MB with an HTML5 entry point. The official check is the Mindworks Review tool.
 */
export class MintegralValidator implements Validator {
  validate(content: string, fileSize: number, _context?: unknown): ValidationResult {
    const hasDoctype = /<!DOCTYPE html>/i.test(content);

    const categories: ValidationCategory[] = [
      {
        name: 'Mintegral',
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
              ? 'Missing HTML5 doctype declaration in the entry file.'
              : undefined,
          },
          {
            name: 'Review with Mindworks Review tool',
            passed: true,
            isWarning: true,
            details: 'Final check: https://www.mindworks-creative.com/review/ (archive name must match the main folder/file inside).',
          },
        ],
      },
    ];

    return { categories };
  }
}
