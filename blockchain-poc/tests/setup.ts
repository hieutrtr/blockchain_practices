// Jest setup file
import dotenv from 'dotenv';

// Load environment variables for tests
dotenv.config({ path: './config.env' });

// Set test timeout
jest.setTimeout(30000);
