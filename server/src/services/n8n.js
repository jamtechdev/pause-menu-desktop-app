// n8n Workflow Automation Service
// Triggers n8n workflows via webhooks

const axios = require('axios');
const UserModel = require('../models/user');

class N8nService {
  constructor() {
    this.enabled = !!process.env.N8N_WEBHOOK_URL;
    this.baseUrl = process.env.N8N_WEBHOOK_URL || '';
    
    if (!this.enabled) {
      console.warn('[N8N] N8N_WEBHOOK_URL not set, n8n workflows will be disabled');
      console.warn('[N8N] Set N8N_WEBHOOK_URL in .env to enable workflow automation');
    } else {
      console.log('[N8N] ✓ n8n workflow automation enabled');
      console.log(`[N8N] Webhook URL: ${this.baseUrl}`);
    }
  }

  /**
   * Trigger n8n workflow
   * @param {string} workflowName - Name of the workflow
   * @param {object} data - Data to send to the workflow
   */
  async triggerWorkflow(workflowName, data) {
    if (!this.enabled) {
      console.log(`[N8N] Would trigger workflow: ${workflowName}`, data);
      return { success: false, skipped: true, reason: 'N8N_WEBHOOK_URL not configured' };
    }

    try {
      const webhookUrl = `${this.baseUrl}/${workflowName}`;
      
      const response = await axios.post(webhookUrl, {
        event: workflowName,
        timestamp: new Date().toISOString(),
        ...data,
      }, {
        timeout: 5000, // 5 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`[N8N] ✓ Triggered workflow: ${workflowName}`);
      return { success: true, response: response.data };
    } catch (error) {
      // Don't throw - n8n failures shouldn't break the main flow
      console.error(`[N8N] ✗ Failed to trigger workflow ${workflowName}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * User Onboarding Workflow
   * Triggered when a new user signs up
   */
  async triggerUserOnboarding(userData) {
    return await this.triggerWorkflow('user-onboarding', {
      userId: userData.id || userData._id?.toString(),
      email: userData.email,
      name: userData.name,
      subscriptionStatus: userData.subscriptionStatus || 'free',
      createdAt: userData.createdAt || new Date().toISOString(),
    });
  }

  /**
   * Subscription Lifecycle Workflow
   * Triggered when subscription status changes
   */
  async triggerSubscriptionLifecycle(eventType, subscriptionData) {
    // Fetch user email for email notifications
    let userEmail = null;
    try {
      const user = await UserModel.findById(subscriptionData.userId);
      if (user) {
        userEmail = user.email;
      }
    } catch (err) {
      console.warn('[N8N] Could not fetch user email for subscription workflow:', err.message);
    }

    return await this.triggerWorkflow('subscription-lifecycle', {
      eventType, // 'created', 'updated', 'canceled', 'renewed'
      userId: subscriptionData.userId,
      email: userEmail, // Include email for email notifications
      subscriptionId: subscriptionData.id || subscriptionData._id?.toString(),
      plan: subscriptionData.plan,
      status: subscriptionData.status,
      stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
      stripeCustomerId: subscriptionData.stripeCustomerId,
      currentPeriodStart: subscriptionData.currentPeriodStart,
      currentPeriodEnd: subscriptionData.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
    });
  }

  /**
   * App Installed Workflow
   * Triggered when app is first launched
   */
  async triggerAppInstalled(deviceData) {
    // Fetch user email for email notifications
    let userEmail = null;
    try {
      const user = await UserModel.findById(deviceData.userId);
      if (user) {
        userEmail = user.email;
      }
    } catch (err) {
      console.warn('[N8N] Could not fetch user email for app installed workflow:', err.message);
    }

    return await this.triggerWorkflow('app-installed', {
      userId: deviceData.userId,
      email: userEmail, // Include email for email notifications
      deviceId: deviceData.deviceId,
      deviceType: deviceData.deviceType, // 'desktop', 'mobile', 'web'
      os: deviceData.os,
      appVersion: deviceData.appVersion,
      installedAt: new Date().toISOString(),
    });
  }

  /**
   * Upload Notes Workflow
   * Triggered when notes are uploaded (future feature)
   */
  async triggerUploadNotes(uploadData) {
    return await this.triggerWorkflow('upload-notes', {
      userId: uploadData.userId,
      fileId: uploadData.fileId,
      fileName: uploadData.fileName,
      fileSize: uploadData.fileSize,
      uploadedAt: new Date().toISOString(),
    });
  }

  /**
   * Calendar Automation Workflow
   * Triggered for calendar events (future feature)
   */
  async triggerCalendarEvent(eventData) {
    return await this.triggerWorkflow('calendar-automation', {
      userId: eventData.userId,
      eventId: eventData.eventId,
      eventTitle: eventData.title,
      eventStart: eventData.start,
      eventEnd: eventData.end,
      eventType: eventData.type,
    });
  }

  /**
   * CRM Integration Workflow
   * Triggered for CRM sync (future feature)
   */
  async triggerCRMSync(syncData) {
    return await this.triggerWorkflow('crm-integration', {
      userId: syncData.userId,
      syncType: syncData.syncType, // 'contact', 'deal', 'activity'
      data: syncData.data,
      syncedAt: new Date().toISOString(),
    });
  }
}

module.exports = new N8nService();

