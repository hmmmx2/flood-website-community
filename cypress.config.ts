import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3002',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    viewportWidth: 1440,
    viewportHeight: 900,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    video: false,
    screenshotOnRunFailure: true,
    experimentalRunAllSpecs: true,
    setupNodeEvents(on, config) {
      on('task', {
        log(message: string) {
          console.log(message);
          return null;
        },
      });
      return config;
    },
  },
  env: {
    USER_EMAIL: 'user@example.com',
    USER_PASSWORD: 'Password@123',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'Admin@123',
    API_BASE: 'http://localhost:3002',
    ACCESS_TOKEN_KEY: 'community_access_token',
    REFRESH_TOKEN_KEY: 'community_refresh_token',
    USER_KEY: 'community_auth_user',
  },
});
