/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        // Node.js 25 exposes a native localStorage that overrides jsdom's.
        // Provide a valid file path so the native API is functional.
        execArgv: ['--localstorage-file=/tmp/vitest-localstorage.json'],
      },
    },
  },
})
