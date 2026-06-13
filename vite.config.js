import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    setupFiles: ['./src/testSetup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/csvHeaders.js', 'src/csvParser.js', 'src/csvValidator.js', 'src/customerUtils.js', 'src/diagnosticRules.js', 'src/fixExecutor.js', 'src/migrationWizard.js'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60
      }
    }
  }
});
