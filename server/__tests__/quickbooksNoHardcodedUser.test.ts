import fs from 'fs';
import path from 'path';

describe('QuickBooks routes avoid hardcoded test user', () => {
  const files = [
    path.resolve(__dirname, '../src/routes/quickbooks.ts'),
    path.resolve(__dirname, '../src/services/quickbooksDisconnect.ts'),
  ];

  it('does not hardcode test@procuroapp.com in production paths', () => {
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toContain("email: 'test@procuroapp.com'");
      expect(content).not.toContain('where: { email: "test@procuroapp.com" }');
    }
  });
});
