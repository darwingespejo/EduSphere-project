// Merge the `server.proxy` block into your existing vite.config.js.
// During development the React app (http://localhost:5173) forwards /api/* to LavaLust,
// so the browser sees one origin and you do not need CORS.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // where LavaLust runs: `php -S localhost:8000 -t public`
        changeOrigin: true,
      },
    },
  },
});
