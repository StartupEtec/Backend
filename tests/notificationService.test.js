import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Minimal mocks - only what NotificationService needs
jest.unstable_mockModule('../src/database/db.js', () => ({ default: jest.fn() }));
jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.unstable_mockModule('../src/services/providers/FirebasePushProvider.js', () => ({
  default: { send: jest.fn() },
}));
jest.unstable_mockModule('../src/services/providers/SendGridEmailProvider.js', () => ({
  default: { send: jest.fn() },
}));
jest.unstable_mockModule('../src/services/providers/TwilioSMSProvider.js', () => ({
  default: { send: jest.fn() },
}));

describe('NotificationService', () => {
  let notificationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    notificationService = (await import('../src/services/NotificationService.js')).default;
  });

  describe('isChannelEnabled', () => {
    it('should return true for push when push_enabled is true', () => {
      const prefs = { push_enabled: true, email_enabled: false, sms_enabled: false };
      expect(notificationService.isChannelEnabled(prefs, 'push')).toBe(true);
    });

    it('should return false for push when push_enabled is false', () => {
      const prefs = { push_enabled: false, email_enabled: true, sms_enabled: true };
      expect(notificationService.isChannelEnabled(prefs, 'push')).toBe(false);
    });

    it('should return true for email when email_enabled is true', () => {
      const prefs = { push_enabled: false, email_enabled: true, sms_enabled: false };
      expect(notificationService.isChannelEnabled(prefs, 'email')).toBe(true);
    });

    it('should return true for sms when sms_enabled is true', () => {
      const prefs = { push_enabled: false, email_enabled: false, sms_enabled: true };
      expect(notificationService.isChannelEnabled(prefs, 'sms')).toBe(true);
    });

    it('should return false for unknown channel', () => {
      const prefs = { push_enabled: true, email_enabled: true, sms_enabled: true };
      expect(notificationService.isChannelEnabled(prefs, 'unknown')).toBe(false);
    });
  });

  describe('isInDNDPeriod', () => {
    it('should return false when dnd_enabled is false', () => {
      const prefs = { dnd_enabled: false, dnd_start: '22:00', dnd_end: '08:00' };
      expect(notificationService.isInDNDPeriod(prefs)).toBe(false);
    });

    it('should return false when dnd_start or dnd_end is null', () => {
      const prefs = { dnd_enabled: true, dnd_start: null, dnd_end: '08:00' };
      expect(notificationService.isInDNDPeriod(prefs)).toBe(false);
    });

    it('should return false when no DND fields are set', () => {
      const prefs = {};
      expect(notificationService.isInDNDPeriod(prefs)).toBe(false);
    });
  });
});
