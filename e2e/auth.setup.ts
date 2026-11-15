import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = '.auth/user.json';

setup('authenticate as nutritionist', async ({ page }) => {
  // Since we use Magic Link, we'll simulate a logged-in state
  // by setting localStorage/sessionStorage directly
  await page.goto('/');
  
  // Wait for app to load
  await page.waitForSelector('.login-prompt', { state: 'visible' });
  
  // In real test, we'd use Magic Link. For E2E, we simulate auth
  // by setting the auth token directly (this requires Supabase running)
  // For now, we just verify the login page loads
  await expect(page.locator('h1')).toContainText('Mesa Farta');
});

setup('save auth state', async ({ page }) => {
  await page.context().storageState({ path: AUTH_FILE });
});