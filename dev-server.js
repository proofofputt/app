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
  
  try {
    const files = await readdir(apiDir);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const routeName = file.replace('.js', '');
        const routePath = path.join(apiDir, file);
        
        try {
          const { default: handler } = await import(routePath);
          
          // Register the route
          app.all(`/api/${routeName}`, (req, res) => {
            handler(req, res);
          });
          
          console.log(`✅ Registered API route: /api/${routeName}`);
        } catch (error) {
          console.error(`❌ Failed to load API route ${routeName}:`, error.message);
        }
      }
    }
    
    // Also load routes from subdirectories
    const subdirs = await readdir(apiDir, { withFileTypes: true });
    for (const dirent of subdirs) {
      if (dirent.isDirectory()) {
        try {
          const subFiles = await readdir(path.join(apiDir, dirent.name));
          for (const subFile of subFiles) {
            if (subFile.endsWith('.js')) {
              const routeName = `${dirent.name}/${subFile.replace('.js', '')}`;
              const routePath = path.join(apiDir, dirent.name, subFile);
              
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
        } catch (error) {
          console.warn(`Could not read subdirectory ${dirent.name}:`, error.message);
        }
      }
    }
    
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