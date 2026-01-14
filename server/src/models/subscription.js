// Subscription model - MongoDB with Mongoose

const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  stripeSubscriptionId: {
    type: String,
    default: null,
    index: true,
  },
  stripeCustomerId: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'trialing', 'incomplete'],
    default: 'active',
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free',
  },
  currentPeriodStart: {
    type: Date,
    default: Date.now,
  },
  currentPeriodEnd: {
    type: Date,
    default: null,
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
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

// Note: indexes are automatically created by index: true on fields

const Subscription = mongoose.model('Subscription', subscriptionSchema);

class SubscriptionModel {
  static async create(data) {
    const subscription = new Subscription(data);
    await subscription.save();
    return subscription;
  }

  static async findById(id) {
    return await Subscription.findById(id);
  }

  static async findByUserId(userId) {
    return await Subscription.findOne({ userId });
  }

  static async findByStripeSubscriptionId(stripeSubscriptionId) {
    return await Subscription.findOne({ stripeSubscriptionId });
  }

  static async update(id, data) {
    data.updatedAt = new Date();
    return await Subscription.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  static async delete(id) {
    return await Subscription.findByIdAndDelete(id);
  }

  static async findAll() {
    return await Subscription.find({});
  }
}

module.exports = { Subscription, SubscriptionModel };
