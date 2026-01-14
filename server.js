const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

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

// Store original filenames (in production, use a database)
const originalNames = new Map();

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Store original filename
    originalNames.set(req.file.filename, req.file.originalname);

    console.log(`[Server] File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`[Server] Saved to: ${req.file.path}`);

    // Return success response
    res.json({
      success: true,
      message: `File "${req.file.originalname}" uploaded successfully!`,
      url: `/uploads/${req.file.filename}`,
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
      return {
        filename,
        originalName,
        size: stats.size,
        uploadedAt: stats.birthtime,
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
  console.log(`📤 Upload endpoint: http://localhost:${PORT}/upload`);
  console.log(`📄 View documents: http://localhost:${PORT}/`);
  console.log(`📋 List files API: http://localhost:${PORT}/files`);
  console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
});

