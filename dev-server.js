import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Dynamically load and register API routes
async function loadAPIRoutes() {
  const apiDir = path.join(__dirname, 'api');

  const registerRoutes = async (dir, prefix = '') => {
    const files = await readdir(dir, { withFileTypes: true });

    for (const file of files) {
      const routePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        await registerRoutes(routePath, `${prefix}${file.name}/`);
      } else if (file.name.endsWith('.js')) {
        const routeName = `${prefix}${file.name.replace('.js', '')}`;
        try {
          const { default: handler } = await import(routePath);
          app.all(`/api/${routeName}`, (req, res) => {
            handler(req, res);
          });
          console.log(`✅ Registered API route: /api/${routeName}`);
        } catch (error) {
          console.error(`❌ Failed to load API route ${routeName}:`, error.message);
        }
      }
    }
  };

  try {
    await registerRoutes(apiDir);
  } catch (error) {
    console.error('Error loading API routes:', error);
  }
}

// Load all API routes
await loadAPIRoutes();

app.listen(PORT, () => {
  console.log(`🚀 Development API server running on http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/*`);
});