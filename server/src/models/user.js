// User model - MongoDB with Mongoose

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: {
    type: String,
    default: null,
  },
  subscriptionStatus: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free',
  },
  subscriptionId: {
    type: String,
    default: null,
  },
  stripeCustomerId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
});

// Note: email index is automatically created by unique: true

// Add toJSON method to schema for consistent output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  return {
    id: obj._id.toString(),
    email: obj.email,
    name: obj.name,
    createdAt: obj.createdAt,
    subscriptionStatus: obj.subscriptionStatus,
  };
};

const User = mongoose.model('User', userSchema);

class UserModel {
  static async create(data) {
    try {
      const user = new User(data);
      await user.save();
      return user;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error (email already exists)
        throw new Error('User with this email already exists');
      }
      throw error;
    }
  }

  static async findById(id) {
    return await User.findById(id);
  }

  static async findByEmail(email) {
    return await User.findOne({ email: email.toLowerCase() });
  }

  static async update(id, data) {
    data.updatedAt = new Date();
    return await User.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  static async delete(id) {
    return await User.findByIdAndDelete(id);
  }

  static async findAll() {
    return await User.find({});
  }
}

module.exports = { User, UserModel };
