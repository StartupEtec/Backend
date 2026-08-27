import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock notificationService
jest.unstable_mockModule('../src/services/NotificationService.js', () => ({
  default: {
    listNotifications: jest.fn().mockResolvedValue({
      notifications: [],
      count: 0,
      total: 0,
      limit: 20,
      offset: 0,
    }),
    getUnreadCount: jest.fn().mockResolvedValue(3),
    markAsRead: jest.fn().mockResolvedValue({
      id: 'notif-123',
      status: 'READ',
      read_at: new Date().toISOString(),
    }),
    markAllAsRead: jest.fn().mockResolvedValue(5),
    getPreferences: jest.fn().mockResolvedValue({
      id: 'pref-123',
      user_id: 'user-123',
      push_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      dnd_enabled: false,
      dnd_start: null,
      dnd_end: null,
    }),
    updatePreferences: jest.fn().mockResolvedValue({
      id: 'pref-123',
      user_id: 'user-123',
      push_enabled: false,
      email_enabled: true,
      sms_enabled: false,
      dnd_enabled: false,
    }),
    send: jest.fn().mockResolvedValue({ id: 'notif-test', status: 'SENT' }),
  },
}));

jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../src/utils/validation.js', () => ({
  updateNotificationPreferencesSchema: {
    validate: jest.fn().mockReturnValue({ value: { push_enabled: false } }),
  },
  listNotificationsSchema: {
    validate: jest.fn().mockReturnValue({ value: { limit: 20, offset: 0 } }),
  },
}));

describe('NotificationController', () => {
  let controller;
  let mockReq;
  let mockRes;
  let mockNext;
  let notificationServiceMock;
  let validationMock;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Re-apply notificationService mock after clearAllMocks
    notificationServiceMock = (await import('../src/services/NotificationService.js')).default;
    notificationServiceMock.listNotifications.mockResolvedValue({
      notifications: [],
      count: 0,
      total: 0,
      limit: 20,
      offset: 0,
    });
    notificationServiceMock.getUnreadCount.mockResolvedValue(3);
    notificationServiceMock.markAsRead.mockResolvedValue({
      id: 'notif-123',
      status: 'READ',
      read_at: new Date().toISOString(),
    });
    notificationServiceMock.markAllAsRead.mockResolvedValue(5);
    notificationServiceMock.getPreferences.mockResolvedValue({
      id: 'pref-123',
      user_id: 'user-123',
      push_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      dnd_enabled: false,
      dnd_start: null,
      dnd_end: null,
    });
    notificationServiceMock.updatePreferences.mockResolvedValue({
      id: 'pref-123',
      user_id: 'user-123',
      push_enabled: false,
      email_enabled: true,
      sms_enabled: false,
      dnd_enabled: false,
    });
    notificationServiceMock.send.mockResolvedValue({ id: 'notif-test', status: 'SENT' });
    validationMock = await import('../src/utils/validation.js');
    validationMock.updateNotificationPreferencesSchema.validate.mockReturnValue({
      value: { push_enabled: false },
    });
    validationMock.listNotificationsSchema.validate.mockReturnValue({ value: {} });
    controller = (await import('../src/controllers/NotificationController.js')).default;
    mockReq = {
      user: { user_id: 'user-123', email: 'test@test.com', current_role: 'client' },
      params: {},
      query: {},
      body: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('listNotifications', () => {
    it('should return notifications list with 200', async () => {
      await controller.listNotifications(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ notifications: expect.any(Array) }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count with 200', async () => {
      await controller.getUnreadCount(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ unread_count: 3 });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read with 200', async () => {
      mockReq.params = { id: 'notif-123' };
      await controller.markAsRead(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when notification not found', async () => {
      const notificationService = (await import('../src/services/NotificationService.js')).default;
      notificationService.markAsRead.mockResolvedValueOnce(null);
      mockReq.params = { id: 'nonexistent' };
      await controller.markAsRead(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all as read with 200', async () => {
      await controller.markAllAsRead(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ marked_count: 5 });
    });
  });

  describe('getPreferences', () => {
    it('should return preferences with 200', async () => {
      await controller.getPreferences(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ preferences: expect.objectContaining({ push_enabled: true }) }),
      );
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences with 200', async () => {
      mockReq.body = { push_enabled: false };
      await controller.updatePreferences(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ preferences: expect.objectContaining({ push_enabled: false }) }),
      );
    });
  });

  describe('sendTestNotification', () => {
    it('should return 403 in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      await controller.sendTestNotification(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      process.env.NODE_ENV = originalEnv;
    });
  });
});
