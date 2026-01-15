// n8n Workflow Automation Routes
// These routes can be called by n8n workflows or trigger n8n workflows

const express = require('express');
const router = express.Router();
const n8nService = require('../services/n8n');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/n8n/app-installed
 * Trigger app installed workflow
 * Called by desktop app on first launch
 */
router.post('/app-installed', authenticateToken, async (req, res) => {
  try {
    const { deviceId, deviceType, os, appVersion } = req.body;

    const result = await n8nService.triggerAppInstalled({
      userId: req.user.userId,
      deviceId: deviceId || `device_${Date.now()}`,
      deviceType: deviceType || 'desktop',
      os: os || 'unknown',
      appVersion: appVersion || '1.0.0',
    });

    res.json({
      success: result.success,
      message: result.success 
        ? 'App installation tracked successfully' 
        : 'App installation tracking skipped (n8n not configured)',
      workflowTriggered: result.success,
    });
  } catch (error) {
    console.error('[N8N] App installed error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to track app installation',
    });
  }
});

/**
 * POST /api/n8n/upload-notes
 * Trigger upload notes workflow (future feature)
 */
router.post('/upload-notes', authenticateToken, async (req, res) => {
  try {
    const { fileId, fileName, fileSize } = req.body;

    if (!fileId || !fileName) {
      return res.status(400).json({
        success: false,
        message: 'fileId and fileName are required',
      });
    }

    const result = await n8nService.triggerUploadNotes({
      userId: req.user.userId,
      fileId,
      fileName,
      fileSize: fileSize || 0,
    });

    res.json({
      success: result.success,
      message: result.success 
        ? 'Upload notes workflow triggered' 
        : 'Upload notes workflow skipped (n8n not configured)',
      workflowTriggered: result.success,
    });
  } catch (error) {
    console.error('[N8N] Upload notes error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to trigger upload notes workflow',
    });
  }
});

/**
 * POST /api/n8n/calendar-event
 * Trigger calendar automation workflow (future feature)
 */
router.post('/calendar-event', authenticateToken, async (req, res) => {
  try {
    const { eventId, title, start, end, type } = req.body;

    if (!eventId || !title || !start) {
      return res.status(400).json({
        success: false,
        message: 'eventId, title, and start are required',
      });
    }

    const result = await n8nService.triggerCalendarEvent({
      userId: req.user.userId,
      eventId,
      title,
      start,
      end,
      type: type || 'meeting',
    });

    res.json({
      success: result.success,
      message: result.success 
        ? 'Calendar event workflow triggered' 
        : 'Calendar event workflow skipped (n8n not configured)',
      workflowTriggered: result.success,
    });
  } catch (error) {
    console.error('[N8N] Calendar event error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to trigger calendar event workflow',
    });
  }
});

/**
 * POST /api/n8n/crm-sync
 * Trigger CRM integration workflow (future feature)
 */
router.post('/crm-sync', authenticateToken, async (req, res) => {
  try {
    const { syncType, data } = req.body;

    if (!syncType || !data) {
      return res.status(400).json({
        success: false,
        message: 'syncType and data are required',
      });
    }

    const result = await n8nService.triggerCRMSync({
      userId: req.user.userId,
      syncType,
      data,
    });

    res.json({
      success: result.success,
      message: result.success 
        ? 'CRM sync workflow triggered' 
        : 'CRM sync workflow skipped (n8n not configured)',
      workflowTriggered: result.success,
    });
  } catch (error) {
    console.error('[N8N] CRM sync error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to trigger CRM sync workflow',
    });
  }
});

/**
 * GET /api/n8n/status
 * Get n8n integration status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    enabled: n8nService.enabled,
    baseUrl: n8nService.baseUrl || null,
    message: n8nService.enabled 
      ? 'n8n workflows are enabled' 
      : 'n8n workflows are disabled (set N8N_WEBHOOK_URL in .env)',
  });
});

module.exports = router;

