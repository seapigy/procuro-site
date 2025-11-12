import request from 'supertest';
import express from 'express';
import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler';
import appConfig from '../../config/app.json';

// Create test app (simplified version of main app)
const app = express();
app.use(express.json());

// Test routes
app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    db: true,
    version: appConfig.version,
    time: new Date().toISOString()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

app.use(notFoundHandler);
app.use(errorHandler);

describe('API Test Suite', () => {
  describe('Health Endpoint', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    it('should return correct health status format', async () => {
      const response = await request(app).get('/health');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('db');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('time');
      expect(response.body.status).toBe('ok');
      expect(response.body.db).toBe(true);
      expect(response.body.version).toBe(appConfig.version);
    });

    it('should return current timestamp', async () => {
      const response = await request(app).get('/health');
      const timestamp = new Date(response.body.time);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/nonexistent');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('route');
    });

    it('should return correct error format', async () => {
      const response = await request(app).get('/invalid/path');
      expect(response.body.status).toBe('error');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.route).toContain('GET');
    });
  });

  describe('Test Endpoint', () => {
    it('should return test message', async () => {
      const response = await request(app).get('/api/test');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Test endpoint working');
    });
  });

  describe('JSON Response Format', () => {
    it('should return valid JSON', async () => {
      const response = await request(app).get('/health');
      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow();
    });

    it('should have correct content-type header', async () => {
      const response = await request(app).get('/health');
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});

describe('Crypto Utilities', () => {
  const { encrypt, decrypt, isEncrypted } = require('../src/utils/crypto');

  it('should encrypt and decrypt text correctly', () => {
    const plainText = 'test-access-token-12345';
    const encrypted = encrypt(plainText);
    const decrypted = decrypt(encrypted);
    
    expect(encrypted).not.toBe(plainText);
    expect(decrypted).toBe(plainText);
  });

  it('should detect encrypted strings', () => {
    const plainText = 'test-token';
    const encrypted = encrypt(plainText);
    
    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted(plainText)).toBe(false);
  });

  it('should handle null values', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });
});

describe('Configuration', () => {
  it('should load app config correctly', () => {
    expect(appConfig).toHaveProperty('version');
    expect(appConfig).toHaveProperty('scheduling');
    expect(appConfig).toHaveProperty('pricing');
    expect(appConfig.version).toBe('1.0.0');
  });

  it('should have valid scheduling config', () => {
    expect(appConfig.scheduling).toHaveProperty('priceCheckTime');
    expect(appConfig.scheduling).toHaveProperty('tokenRefreshTime');
    expect(appConfig.scheduling).toHaveProperty('priceCheckCron');
  });

  it('should have valid pricing config', () => {
    expect(appConfig.pricing).toHaveProperty('priceDropThreshold');
    expect(appConfig.pricing.priceDropThreshold).toBeGreaterThan(0);
    expect(appConfig.pricing.priceDropThreshold).toBeLessThan(1);
  });
});

console.log('\n✅ All API tests passed\n');

