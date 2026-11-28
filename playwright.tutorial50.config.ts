import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base, testIgnore: [], testMatch: 'final-tutorial50.spec.ts',
  outputDir: 'test-results/tutorial50', timeout: 90000, fullyParallel: true,
  use: {...base.use, baseURL: 'http://127.0.0.1:5195'},
  webServer: {
    // Exercise the optimized product bundle with the flag absent (default ON),
    // not a dev server or the preview-only SDK injection surface.
    command: 'env -u VITE_SEEDS_FIRST_SESSION VITE_SEEDS_QA_PROFILE= npm run build && npx vite preview --host 127.0.0.1 --port 5195',
    url: 'http://127.0.0.1:5195', reuseExistingServer: false,
    env: {VITE_SEEDS_QA_PROFILE: ''},
  },
});
