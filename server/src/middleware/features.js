// Feature access middleware - Check if user has access to specific features

const stripeService = require('../services/stripe');

/**
 * Middleware to check if user has access to a specific feature
 * Usage: router.get('/pro-feature', authenticateToken, checkFeature('advancedAnalytics'), handler)
 */
function checkFeature(featureName) {
  return async (req, res, next) => {
    try {
      const hasAccess = await stripeService.hasFeatureAccess(req.user.userId, featureName);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `This feature requires a Pro subscription. Upgrade to unlock this feature.`,
          requiresUpgrade: true,
          feature: featureName,
        });
      }

      next();
    } catch (error) {
      console.error('[Features] Check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check feature access',
      });
    }
  };
}

/**
 * Middleware to check if user has a specific plan or higher
 * Usage: router.get('/pro-only', authenticateToken, checkPlan('pro'), handler)
 */
function checkPlan(minimumPlan) {
  const planHierarchy = {
    free: 0,
    pro: 1,
    enterprise: 2,
  };

  return async (req, res, next) => {
    try {
      const status = await stripeService.getSubscriptionStatus(req.user.userId);
      const userPlanLevel = planHierarchy[status.plan] || 0;
      const requiredPlanLevel = planHierarchy[minimumPlan] || 0;

      if (userPlanLevel < requiredPlanLevel || !status.active) {
        return res.status(403).json({
          success: false,
          message: `This feature requires a ${minimumPlan} subscription or higher.`,
          requiresUpgrade: true,
          currentPlan: status.plan,
          requiredPlan: minimumPlan,
        });
      }

      next();
    } catch (error) {
      console.error('[Features] Plan check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check plan access',
      });
    }
  };
}

module.exports = {
  checkFeature,
  checkPlan,
};

