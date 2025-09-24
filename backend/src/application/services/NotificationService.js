const EventLog = require('../../domain/entities/EventLog');

/**
 * NotificationService
 * 
 * Handles notifications for schedule-related events including execution confirmations,
 * failures, upcoming schedules, and system alerts. Supports multiple notification
 * channels and provides a unified interface for all scheduling-related communications.
 */
class NotificationService {
  constructor(
    eventLogRepository,
    eventBus,
    emailService = null,
    smsService = null,
    pushService = null,
    userRepository = null
  ) {
    this.eventLogRepository = eventLogRepository;
    this.eventBus = eventBus;
    this.emailService = emailService;
    this.smsService = smsService;
    this.pushService = pushService;
    this.userRepository = userRepository;

    // Subscribe to domain events if event bus is available
    if (this.eventBus) {
      this._subscribeToEvents();
    }
  }

  /**
   * Sends notification for successful schedule execution
   * 
   * @param {Object} executionData - Execution details
   * @param {string} executionData.userId - User ID
   * @param {Object} executionData.schedule - Schedule that was executed
   * @param {Object} executionData.result - Execution result
   * @param {Date} executionData.executionTime - When it was executed
   * @param {Object} options - Notification options
   * 
   * @returns {Promise<Object>} Notification result
   */
  async notifyScheduleExecuted(executionData, options = {}) {
    const { userId, schedule, result, executionTime } = executionData;

    try {
      const message = this._createExecutionSuccessMessage(schedule, result, executionTime);
      const notificationData = {
        type: 'schedule_executed',
        title: 'Schedule Executed Successfully',
        message: message.text,
        data: {
          scheduleId: schedule.id,
          actionType: schedule.actionType,
          executionTime,
          result
        }
      };

      return await this._sendNotification(userId, notificationData, options);

    } catch (error) {
      console.error('Failed to send schedule execution notification:', error);
      return {
        success: false,
        error: 'Failed to send notification',
        details: { message: error.message }
      };
    }
  }

  /**
   * Sends notification for failed schedule execution
   * 
   * @param {Object} failureData - Failure details
   * @param {string} failureData.userId - User ID
   * @param {Object} failureData.schedule - Schedule that failed
   * @param {string} failureData.error - Error message
   * @param {Date} failureData.executionTime - When failure occurred
   * @param {boolean} failureData.willRetry - Whether the system will retry
   * @param {Object} options - Notification options
   * 
   * @returns {Promise<Object>} Notification result
   */
  async notifyScheduleExecutionFailed(failureData, options = {}) {
    const { userId, schedule, error, executionTime, willRetry } = failureData;

    try {
      const message = this._createExecutionFailureMessage(schedule, error, executionTime, willRetry);
      const notificationData = {
        type: 'schedule_execution_failed',
        title: 'Schedule Execution Failed',
        message: message.text,
        priority: 'high',
        data: {
          scheduleId: schedule.id,
          actionType: schedule.actionType,
          error,
          executionTime,
          willRetry
        }
      };

      return await this._sendNotification(userId, notificationData, {
        ...options,
        forceImmediate: true // Failed executions should be sent immediately
      });

    } catch (error) {
      console.error('Failed to send schedule execution failure notification:', error);
      return {
        success: false,
        error: 'Failed to send notification',
        details: { message: error.message }
      };
    }
  }

  /**
   * Sends notification for upcoming schedule executions
   * 
   * @param {Object} upcomingData - Upcoming execution details
   * @param {string} upcomingData.userId - User ID
   * @param {Array} upcomingData.schedules - Upcoming schedules
   * @param {string} upcomingData.timeframe - Timeframe (e.g., "next hour", "today")
   * @param {Object} options - Notification options
   * 
   * @returns {Promise<Object>} Notification result
   */
  async notifyUpcomingSchedules(upcomingData, options = {}) {
    const { userId, schedules, timeframe } = upcomingData;

    try {
      if (schedules.length === 0) {
        return { success: true, message: 'No upcoming schedules to notify about' };
      }

      const message = this._createUpcomingSchedulesMessage(schedules, timeframe);
      const notificationData = {
        type: 'upcoming_schedules',
        title: `Upcoming Schedules - ${timeframe}`,
        message: message.text,
        data: {
          timeframe,
          schedules: schedules.map(s => ({
            id: s.id,
            description: s.description,
            nextExecution: s.nextExecution,
            actionType: s.actionType
          }))
        }
      };

      return await this._sendNotification(userId, notificationData, options);

    } catch (error) {
      console.error('Failed to send upcoming schedules notification:', error);
      return {
        success: false,
        error: 'Failed to send notification',
        details: { message: error.message }
      };
    }
  }

  /**
   * Sends notification for schedule creation
   * 
   * @param {Object} creationData - Schedule creation details
   * @param {Object} options - Notification options
   * 
   * @returns {Promise<Object>} Notification result
   */
  async notifyScheduleCreated(creationData, options = {}) {
    const { userId, schedule, warnings } = creationData;

    try {
      const message = this._createScheduleCreatedMessage(schedule, warnings);
      const notificationData = {
        type: 'schedule_created',
        title: 'New Schedule Created',
        message: message.text,
        data: {
          scheduleId: schedule.id,
          description: schedule.description,
          nextExecution: schedule.nextExecution,
          warnings: warnings || []
        }
      };

      return await this._sendNotification(userId, notificationData, {
        ...options,
        channels: options.channels || ['push'] // Default to push notifications for creation
      });

    } catch (error) {
      console.error('Failed to send schedule creation notification:', error);
      return {
        success: false,
        error: 'Failed to send notification',
        details: { message: error.message }
      };
    }
  }

  /**
   * Sends notification for schedule cancellation
   * 
   * @param {Object} cancellationData - Cancellation details
   * @param {Object} options - Notification options
   * 
   * @returns {Promise<Object>} Notification result
   */
  async notifyScheduleCancelled(cancellationData, options = {}) {
    const { userId, schedule, reason, impactAnalysis } = cancellationData;

    try {
      const message = this._createScheduleCancelledMessage(schedule, reason, impactAnalysis);
      const notificationData = {
        type: 'schedule_cancelled',
        title: 'Schedule Cancelled',
        message: message.text,
        data: {
          scheduleId: schedule.id,
          description: schedule.description,
          reason,
          impactAnalysis
        }
      };

      return await this._sendNotification(userId, notificationData, options);

    } catch (error) {
      console.error('Failed to send schedule cancellation notification:', error);
      return {
        success: false,
        error: 'Failed to send notification',
        details: { message: error.message }
      };
    }
  }

  /**
   * Sends notification for overdue schedules
   * 
   * @param {Object} overdueData - Overdue schedule details
   * @param {Object} options - Notification options
   * 
   * @returns {Promise<Object>} Notification result
   */
  async notifyOverdueSchedules(overdueData, options = {}) {
    const { userId, schedules } = overdueData;

    try {
      if (schedules.length === 0) {
        return { success: true, message: 'No overdue schedules to notify about' };
      }

      const message = this._createOverdueSchedulesMessage(schedules);
      const notificationData = {
        type: 'overdue_schedules',
        title: 'Overdue Schedules Alert',
        message: message.text,
        priority: 'high',
        data: {
          overdueCount: schedules.length,
          schedules: schedules.map(s => ({
            id: s.id,
            description: s.description,
            scheduledTime: s.nextExecution,
            overdueMinutes: this._calculateOverdueMinutes(s.nextExecution)
          }))
        }
      };

      return await this._sendNotification(userId, notificationData, {
        ...options,
        forceImmediate: true,
        channels: options.channels || ['email', 'push'] // Use multiple channels for overdue alerts
      });

    } catch (error) {
      console.error('Failed to send overdue schedules notification:', error);
      return {
        success: false,
        error: 'Failed to send notification',
        details: { message: error.message }
      };
    }
  }

  /**
   * Sends daily/weekly schedule summary notifications
   * 
   * @param {Object} summaryData - Summary details
   * @param {Object} options - Notification options
   * 
   * @returns {Promise<Object>} Notification result
   */
  async sendScheduleSummary(summaryData, options = {}) {
    const { userId, period, summary } = summaryData;

    try {
      const message = this._createScheduleSummaryMessage(period, summary);
      const notificationData = {
        type: 'schedule_summary',
        title: `${period} Schedule Summary`,
        message: message.text,
        data: {
          period,
          summary,
          generatedAt: new Date()
        }
      };

      return await this._sendNotification(userId, notificationData, {
        ...options,
        channels: options.channels || ['email'] // Summaries typically via email
      });

    } catch (error) {
      console.error('Failed to send schedule summary notification:', error);
      return {
        success: false,
        error: 'Failed to send notification',
        details: { message: error.message }
      };
    }
  }

  /**
   * Sets notification preferences for a user
   * 
   * @param {string} userId - User ID
   * @param {Object} preferences - Notification preferences
   * 
   * @returns {Promise<Object>} Result of preference update
   */
  async setNotificationPreferences(userId, preferences) {
    try {
      // Store preferences (would typically go to database)
      const userPreferences = {
        userId,
        scheduleExecution: preferences.scheduleExecution !== false,
        scheduleFailures: preferences.scheduleFailures !== false,
        upcomingSchedules: preferences.upcomingSchedules !== false,
        scheduleCreation: preferences.scheduleCreation !== false,
        scheduleCancellation: preferences.scheduleCancellation !== false,
        overdueAlerts: preferences.overdueAlerts !== false,
        summaryReports: preferences.summaryReports !== false,
        channels: preferences.channels || ['push'],
        quietHours: preferences.quietHours || { start: '22:00', end: '07:00' },
        updatedAt: new Date()
      };

      // Create audit log for preference change
      const eventLog = EventLog.createCustomEvent(
        'NOTIFICATION_PREFERENCES_UPDATED',
        'User updated notification preferences',
        userId,
        { preferences: userPreferences }
      );
      await this.eventLogRepository.save(eventLog);

      return {
        success: true,
        message: 'Notification preferences updated successfully',
        data: userPreferences
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to update notification preferences',
        details: { message: error.message }
      };
    }
  }

  /**
   * Gets notification preferences for a user
   * 
   * @param {string} userId - User ID
   * 
   * @returns {Promise<Object>} User's notification preferences
   */
  async getNotificationPreferences(userId) {
    try {
      // In a real implementation, this would fetch from database
      // For now, return default preferences
      const defaultPreferences = {
        userId,
        scheduleExecution: true,
        scheduleFailures: true,
        upcomingSchedules: true,
        scheduleCreation: true,
        scheduleCancellation: true,
        overdueAlerts: true,
        summaryReports: false,
        channels: ['push'],
        quietHours: { start: '22:00', end: '07:00' }
      };

      return {
        success: true,
        data: defaultPreferences
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to get notification preferences',
        details: { message: error.message }
      };
    }
  }

  /**
   * Private: Subscribes to domain events
   */
  _subscribeToEvents() {
    // Subscribe to ScheduleCreated events
    this.eventBus.subscribe('ScheduleCreated', async (event) => {
      await this.notifyScheduleCreated({
        userId: event.userId,
        schedule: event.data,
        warnings: []
      });
    });

    // Subscribe to ScheduleExecuted events
    this.eventBus.subscribe('ScheduleExecuted', async (event) => {
      await this.notifyScheduleExecuted({
        userId: event.userId,
        schedule: event.data,
        result: event.executionResult,
        executionTime: event.executionTime
      });
    });

    // Subscribe to ScheduleFailed events
    this.eventBus.subscribe('ScheduleFailed', async (event) => {
      await this.notifyScheduleExecutionFailed({
        userId: event.userId,
        schedule: event.data,
        error: event.error,
        executionTime: event.executionTime,
        willRetry: event.willRetry
      });
    });

    // Subscribe to ScheduleCancelled events
    this.eventBus.subscribe('ScheduleCancelled', async (event) => {
      await this.notifyScheduleCancelled({
        userId: event.userId,
        schedule: event.data,
        reason: event.reason,
        impactAnalysis: event.impactAnalysis
      });
    });
  }

  /**
   * Private: Sends notification via configured channels
   */
  async _sendNotification(userId, notificationData, options = {}) {
    const userPreferences = await this._getUserNotificationPreferences(userId);
    
    if (!userPreferences || !this._shouldSendNotification(notificationData.type, userPreferences, options)) {
      return { success: true, message: 'Notification skipped due to user preferences' };
    }

    const channels = options.channels || userPreferences.channels || ['push'];
    const results = [];

    for (const channel of channels) {
      try {
        const result = await this._sendViaChannel(channel, userId, notificationData, userPreferences);
        results.push({ channel, ...result });
      } catch (error) {
        results.push({ 
          channel, 
          success: false, 
          error: error.message 
        });
      }
    }

    // Create audit log for notification
    await this._createNotificationAuditLog(userId, notificationData, results);

    const successCount = results.filter(r => r.success).length;
    const totalChannels = results.length;

    return {
      success: successCount > 0,
      message: `Notification sent via ${successCount}/${totalChannels} channels`,
      data: {
        notificationType: notificationData.type,
        channels: results,
        successCount,
        totalChannels
      }
    };
  }

  /**
   * Private: Sends notification via specific channel
   */
  async _sendViaChannel(channel, userId, notificationData, userPreferences) {
    // Check quiet hours
    if (this._isQuietHours(userPreferences.quietHours) && !notificationData.priority === 'high') {
      return { success: true, message: 'Delayed due to quiet hours' };
    }

    switch (channel) {
      case 'email':
        return await this._sendEmail(userId, notificationData);
      
      case 'sms':
        return await this._sendSMS(userId, notificationData);
      
      case 'push':
        return await this._sendPushNotification(userId, notificationData);
      
      default:
        return { success: false, error: `Unknown channel: ${channel}` };
    }
  }

  /**
   * Private: Email notification implementation
   */
  async _sendEmail(userId, notificationData) {
    if (!this.emailService) {
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const user = await this._getUserInfo(userId);
      if (!user || !user.email) {
        return { success: false, error: 'User email not found' };
      }

      const emailData = {
        to: user.email,
        subject: notificationData.title,
        text: notificationData.message,
        html: this._createEmailHTML(notificationData)
      };

      await this.emailService.send(emailData);
      return { success: true, message: 'Email sent successfully' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Private: SMS notification implementation
   */
  async _sendSMS(userId, notificationData) {
    if (!this.smsService) {
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const user = await this._getUserInfo(userId);
      if (!user || !user.phone) {
        return { success: false, error: 'User phone number not found' };
      }

      await this.smsService.send({
        to: user.phone,
        message: `${notificationData.title}: ${notificationData.message}`
      });

      return { success: true, message: 'SMS sent successfully' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Private: Push notification implementation
   */
  async _sendPushNotification(userId, notificationData) {
    if (!this.pushService) {
      return { success: false, error: 'Push service not configured' };
    }

    try {
      await this.pushService.send({
        userId,
        title: notificationData.title,
        body: notificationData.message,
        data: notificationData.data
      });

      return { success: true, message: 'Push notification sent successfully' };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Private: Message creation methods
   */
  _createExecutionSuccessMessage(schedule, result, executionTime) {
    const timeStr = executionTime.toLocaleTimeString();
    return {
      text: `Successfully executed "${schedule.description}" at ${timeStr}. ${result.message || ''}`
    };
  }

  _createExecutionFailureMessage(schedule, error, executionTime, willRetry) {
    const timeStr = executionTime.toLocaleTimeString();
    const retryText = willRetry ? ' The system will retry automatically.' : '';
    return {
      text: `Failed to execute "${schedule.description}" at ${timeStr}: ${error}.${retryText}`
    };
  }

  _createUpcomingSchedulesMessage(schedules, timeframe) {
    if (schedules.length === 1) {
      const schedule = schedules[0];
      return {
        text: `Upcoming schedule: "${schedule.description}" will execute ${timeframe}`
      };
    } else {
      return {
        text: `${schedules.length} schedules will execute ${timeframe}: ${schedules.map(s => s.description).join(', ')}`
      };
    }
  }

  _createScheduleCreatedMessage(schedule, warnings) {
    let text = `New schedule created: "${schedule.description}"`;
    if (schedule.nextExecution) {
      text += ` Next execution: ${schedule.nextExecution.toLocaleString()}`;
    }
    if (warnings && warnings.length > 0) {
      text += ` Note: ${warnings.join(', ')}`;
    }
    return { text };
  }

  _createScheduleCancelledMessage(schedule, reason, impactAnalysis) {
    let text = `Schedule cancelled: "${schedule.description}"`;
    if (reason) {
      text += ` Reason: ${reason}`;
    }
    if (impactAnalysis && impactAnalysis.missedExecutions > 0) {
      text += ` This affects ${impactAnalysis.missedExecutions} upcoming executions.`;
    }
    return { text };
  }

  _createOverdueSchedulesMessage(schedules) {
    if (schedules.length === 1) {
      const schedule = schedules[0];
      const overdueMinutes = this._calculateOverdueMinutes(schedule.nextExecution);
      return {
        text: `Schedule "${schedule.description}" is ${overdueMinutes} minutes overdue`
      };
    } else {
      return {
        text: `${schedules.length} schedules are overdue and need attention`
      };
    }
  }

  _createScheduleSummaryMessage(period, summary) {
    return {
      text: `${period} Summary: ${summary.executed || 0} schedules executed, ${summary.failed || 0} failed, ${summary.upcoming || 0} upcoming`
    };
  }

  _createEmailHTML(notificationData) {
    return `
      <html>
        <body>
          <h2>${notificationData.title}</h2>
          <p>${notificationData.message}</p>
          ${notificationData.data ? `<pre>${JSON.stringify(notificationData.data, null, 2)}</pre>` : ''}
        </body>
      </html>
    `;
  }

  /**
   * Private: Helper methods
   */
  async _getUserNotificationPreferences(userId) {
    const preferencesResult = await this.getNotificationPreferences(userId);
    return preferencesResult.success ? preferencesResult.data : null;
  }

  async _getUserInfo(userId) {
    if (!this.userRepository) {
      return null;
    }

    try {
      return await this.userRepository.findById(userId);
    } catch (error) {
      return null;
    }
  }

  _shouldSendNotification(notificationType, userPreferences, options) {
    if (options.forceImmediate) {
      return true;
    }

    // Check if user has enabled this notification type
    const typeMapping = {
      'schedule_executed': 'scheduleExecution',
      'schedule_execution_failed': 'scheduleFailures',
      'upcoming_schedules': 'upcomingSchedules',
      'schedule_created': 'scheduleCreation',
      'schedule_cancelled': 'scheduleCancellation',
      'overdue_schedules': 'overdueAlerts',
      'schedule_summary': 'summaryReports'
    };

    const preferenceKey = typeMapping[notificationType];
    return preferenceKey ? userPreferences[preferenceKey] : true;
  }

  _isQuietHours(quietHours) {
    if (!quietHours) return false;

    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    
    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 100 + startMin;
    const endTime = endHour * 100 + endMin;

    if (startTime > endTime) {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  _calculateOverdueMinutes(scheduledTime) {
    if (!scheduledTime) return 0;
    return Math.floor((Date.now() - scheduledTime.getTime()) / (1000 * 60));
  }

  async _createNotificationAuditLog(userId, notificationData, results) {
    try {
      const eventLog = EventLog.createCustomEvent(
        'NOTIFICATION_SENT',
        `Sent ${notificationData.type} notification`,
        userId,
        {
          notificationType: notificationData.type,
          title: notificationData.title,
          channels: results.map(r => ({ channel: r.channel, success: r.success })),
          timestamp: new Date()
        }
      );

      await this.eventLogRepository.save(eventLog);
    } catch (error) {
      console.error('Failed to create notification audit log:', error);
    }
  }
}

module.exports = NotificationService;