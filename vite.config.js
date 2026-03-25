import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    root: '.',
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        input: './public/index.html',
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            router: ['react-router-dom'],
            datefns: ['date-fns'],
          },
        },
      },
    },
    server: { port: 3000, open: true },
  };
});
