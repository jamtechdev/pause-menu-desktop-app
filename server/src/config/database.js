// MongoDB database connection

const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    console.log('[Database] Already connected to MongoDB');
    return;
  }

  try {
    // Use provided MongoDB URI or default
    // Note: @ symbol in password must be URL encoded as %40
    // Original: Test@123 -> Encoded: Test%40123
    let mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      // Default connection string with URL-encoded password
      mongoUri = 'mongodb+srv://jamtech:Test%40123@cluster0.ue7zsuy.mongodb.net/letmesell?retryWrites=true&w=majority';
    }
    
    // Ensure database name is in the URI
    if (!mongoUri.includes('/letmesell') && !mongoUri.match(/\/[^?]+/)) {
      // Add database name if not present
      const separator = mongoUri.includes('?') ? '?' : '/';
      mongoUri = mongoUri.replace(separator, '/letmesell' + separator);
    }
    
    console.log('[Database] Connecting to MongoDB...');
    console.log('[Database] URI:', mongoUri.replace(/:[^:@]+@/, ':****@')); // Hide password in logs
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // Timeout after 10s
      maxPoolSize: 10, // Maintain up to 10 socket connections
    });

    isConnected = true;
    console.log('[Database] ✓ Connected to MongoDB');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('[Database] ✗ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[Database] MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('[Database] ✓ MongoDB reconnected');
      isConnected = true;
    });

  } catch (error) {
    console.error('[Database] ✗ MongoDB connection failed:', error.message);
    console.error('[Database] Make sure MongoDB URI is correct and network is accessible');
    isConnected = false;
    throw error;
  }
}

async function disconnectDB() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[Database] Disconnected from MongoDB');
  }
}

module.exports = { connectDB, disconnectDB, isConnected: () => isConnected };

