const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { connectDB } = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB().catch(err => {
  console.error('[Server] Failed to connect to MongoDB:', err.message);
  console.warn('[Server] Server will continue but database features may not work');
});

// API Routes
const authRoutes = require('./src/routes/auth');
const subscriptionRoutes = require('./src/routes/subscription');
const userRoutes = require('./src/routes/user');
const analyticsRoutes = require('./src/routes/analytics');

app.use('/api/auth', authRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/user', userRoutes);
app.use('/api/analytics', analyticsRoutes);

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/', // Directory to save uploaded files
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Store original filenames and MIME types (in production, use a database)
const originalNames = new Map();
const fileMimeTypes = new Map();

// Custom route to serve uploaded files with proper Content-Type headers
app.get('/uploads/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    
    // Get MIME type from stored map, or try to detect from original filename or file content
    let mimeType = fileMimeTypes.get(filename);
    if (!mimeType) {
      const originalName = originalNames.get(filename) || filename;
      const ext = path.extname(originalName).toLowerCase();
      // Common MIME types
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.html': 'text/html',
        '.htm': 'text/html',
        '.svg': 'image/svg+xml',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.xml': 'application/xml',
      };
      mimeType = mimeTypes[ext];
      
      // If still no MIME type, try to detect from file content
      if (!mimeType) {
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const firstBytes = fileBuffer.slice(0, 4);
          
          // Check for PDF
          if (fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46) {
            mimeType = 'application/pdf';
          }
          // Check for PNG
          else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
            mimeType = 'image/png';
          }
          // Check for JPEG
          else if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8 && fileBuffer[2] === 0xFF) {
            mimeType = 'image/jpeg';
          }
          // Check for GIF
          else if (fileBuffer[0] === 0x47 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46) {
            mimeType = 'image/gif';
          }
          // Check if it's text (first 512 bytes are mostly printable ASCII)
          else {
            const textSample = fileBuffer.slice(0, Math.min(512, fileBuffer.length)).toString('utf8');
            const isText = /^[\x20-\x7E\s]*$/.test(textSample);
            if (isText) {
              mimeType = 'text/plain';
            } else {
              mimeType = 'application/octet-stream';
            }
          }
        } catch (err) {
          mimeType = 'application/octet-stream';
        }
      }
    }
    
    // Set Content-Type header
    res.setHeader('Content-Type', mimeType);
    
    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error('[Server] Error serving file:', error);
    res.status(500).send('Error serving file');
  }
});

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Store original filename and MIME type
    originalNames.set(req.file.filename, req.file.originalname);
    if (req.file.mimetype) {
      fileMimeTypes.set(req.file.filename, req.file.mimetype);
    }

    console.log(`[Server] File uploaded: ${req.file.originalname} (${req.file.size} bytes, ${req.file.mimetype || 'unknown type'})`);
    console.log(`[Server] Saved to: ${req.file.path}`);

    // Return success response
    res.json({
      success: true,
      message: `File "${req.file.originalname}" uploaded successfully!`,
      url: `/uploads/${req.file.filename}`,
      viewUrl: `http://localhost:${PORT}/uploads/${req.file.filename}`,
      file: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('[Server] Upload error:', error);
    res.status(500).json({
      success: false,
      message: `Upload failed: ${error.message}`
    });
  }
});

// List all uploaded files
app.get('/files', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir).map(filename => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      const originalName = originalNames.get(filename) || filename;
      const mimeType = fileMimeTypes.get(filename) || 'application/octet-stream';
      return {
        filename,
        originalName,
        size: stats.size,
        uploadedAt: stats.birthtime,
        mimeType,
        url: `/uploads/${filename}`,
        viewUrl: `http://localhost:${PORT}/uploads/${filename}`
      };
    });

    res.json({
      success: true,
      files: files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)) // Most recent first
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to list files: ${error.message}`
    });
  }
});

// Simple HTML page to view uploaded files
app.get('/', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir).map(filename => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      const originalName = originalNames.get(filename) || filename;
      return {
        filename,
        originalName,
        size: stats.size,
        uploadedAt: stats.birthtime,
        url: `/uploads/${filename}`
      };
    }).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>LetMeSell - Uploaded Documents</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #1a1a1a;
      color: #e0e0e0;
    }
    h1 {
      color: #fff;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 10px;
    }
    .file-list {
      margin-top: 20px;
    }
    .file-item {
      background: #2a2a2a;
      border: 1px solid #3a3a3a;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .file-info {
      flex: 1;
    }
    .file-name {
      font-weight: 600;
      color: #fff;
      margin-bottom: 5px;
    }
    .file-meta {
      font-size: 0.875rem;
      color: #999;
    }
    .file-actions {
      display: flex;
      gap: 10px;
    }
    a {
      color: #3b82f6;
      text-decoration: none;
      padding: 8px 16px;
      background: #1e3a5f;
      border-radius: 6px;
      transition: background 0.2s;
    }
    a:hover {
      background: #2a4f7a;
    }
    .empty {
      text-align: center;
      padding: 40px;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>📄 Uploaded Documents</h1>
  <div class="file-list">
    ${files.length === 0 
      ? '<div class="empty">No files uploaded yet. Upload files from the app to see them here.</div>'
      : files.map(file => `
        <div class="file-item">
          <div class="file-info">
            <div class="file-name">${file.originalName}</div>
            <div class="file-meta">
              ${(file.size / 1024).toFixed(2)} KB • 
              Uploaded ${new Date(file.uploadedAt).toLocaleString()}
            </div>
          </div>
          <div class="file-actions">
            <a href="${file.url}" target="_blank">View</a>
            <a href="${file.url}" download>Download</a>
          </div>
        </div>
      `).join('')
    }
  </div>
</body>
</html>
    `;
    res.send(html);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'LetMeSell API server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 LetMeSell API Server running on http://localhost:${PORT}`);
  console.log(`\n📋 API Endpoints:`);
  console.log(`   POST   /api/auth/login          - Request magic link`);
  console.log(`   POST   /api/auth/verify         - Verify magic link (JSON)`);
  console.log(`   GET    /api/auth/verify         - Verify magic link (Browser)`);
  console.log(`   GET    /api/user/profile        - Get user profile`);
  console.log(`   PUT    /api/user/profile        - Update user profile`);
  console.log(`   GET    /api/subscription/status - Get subscription status`);
  console.log(`   POST   /api/subscription/checkout - Create checkout session`);
  console.log(`   POST   /api/subscription/webhook - Stripe webhook`);
  console.log(`   POST   /api/analytics/event     - Track analytics event`);
  console.log(`\n📤 File Upload:`);
  console.log(`   POST   /upload                  - Upload file`);
  console.log(`   GET    /files                   - List files`);
  console.log(`   GET    /                        - View documents`);
  console.log(`   GET    /health                  - Health check\n`);
});
