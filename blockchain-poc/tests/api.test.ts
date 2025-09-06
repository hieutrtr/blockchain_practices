import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../src/api/server';
import { PrismaClient } from '@prisma/client';

describe('API Endpoints', () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = new PrismaClient();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('should return health status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.database).toBe('connected');
  });

  it('should return API info', async () => {
    const response = await request(app).get('/api');
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Blockchain Data API');
    expect(response.body.version).toBe('1.0.0');
    expect(response.body.endpoints).toBeDefined();
  });

  it('should return blocks list', async () => {
    const response = await request(app).get('/api/blocks');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.count).toBeDefined();
  });

  it('should return tokens list', async () => {
    const response = await request(app).get('/api/tokens');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.count).toBeDefined();
  });

  it('should handle 404 for unknown endpoints', async () => {
    const response = await request(app).get('/api/unknown');
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Endpoint not found');
  });
});
