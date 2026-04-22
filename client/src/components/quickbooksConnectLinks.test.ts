import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('QuickBooks connect links are API-origin safe', () => {
  const files = [
    path.resolve(__dirname, './Dashboard.tsx'),
    path.resolve(__dirname, './Settings.tsx'),
    path.resolve(__dirname, './AccountModal.tsx'),
  ];

  it('does not use hardcoded /api/qb/connect href in React components', () => {
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toContain('href="/api/qb/connect"');
      expect(content).toContain("apiUrl('/api/qb/connect')");
    }
  });
});
