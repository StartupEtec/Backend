import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import { initialCategories } from '../src/database/seeds/01_categories.js';
import { testClients, testWorkers } from '../src/database/seeds/02_users_and_profiles.js';
import { sampleOrders } from '../src/database/seeds/03_orders_and_escrow.js';
import { sampleRatings, sampleChats } from '../src/database/seeds/04_ratings_and_chats.js';
import { clearDatabase } from '../src/database/seeds/clear.js';
import { decrypt } from '../src/utils/encryption.js';

describe('Database Seeds and Clear Script Suite', () => {
  describe('01_categories.js - Service Categories', () => {
    it('debe contener al menos 30 categorías de servicios', () => {
      expect(initialCategories.length).toBeGreaterThanOrEqual(30);
    });

    it('cada categoría debe tener estructura válida y estar activa', () => {
      for (const cat of initialCategories) {
        expect(cat.id).toBeDefined();
        expect(typeof cat.name).toBe('string');
        expect(cat.name.length).toBeGreaterThan(2);
        expect(typeof cat.description).toBe('string');
        expect(cat.icon_url).toBeDefined();
        expect(cat.active).toBe(true);
      }
    });

    it('todas las categorías deben tener IDs y nombres únicos', () => {
      const ids = initialCategories.map((c) => c.id);
      const names = initialCategories.map((c) => c.name);
      expect(new Set(ids).size).toBe(initialCategories.length);
      expect(new Set(names).size).toBe(initialCategories.length);
    });
  });

  describe('02_users_and_profiles.js - Test Users and Profiles', () => {
    it('debe contener exactamente 5 clientes de prueba', () => {
      expect(testClients.length).toBe(5);
    });

    it('debe contener exactamente 5 trabajadores de prueba', () => {
      expect(testWorkers.length).toBe(5);
    });

    it('todos los clientes deben tener contraseña válida "test123!"', async () => {
      for (const client of testClients) {
        const matches = await bcrypt.compare('test123!', client.user.password_hash);
        expect(matches).toBe(true);
        expect(client.user.is_verified).toBe(true);
        expect(client.user.current_role).toBe('client');
      }
    });

    it('todos los trabajadores deben tener contraseña válida "test123!"', async () => {
      for (const worker of testWorkers) {
        const matches = await bcrypt.compare('test123!', worker.user.password_hash);
        expect(matches).toBe(true);
        expect(worker.user.is_verified).toBe(true);
        expect(worker.user.current_role).toBe('worker');
      }
    });

    it('cada cliente debe tener ubicación primaria y método de pago con tarjeta encriptada', () => {
      for (const client of testClients) {
        expect(client.location.address).toBeDefined();
        expect(client.location.latitude).toBeLessThan(0); // Coordenadas hemisferio sur (Bs As)
        expect(client.location.longitude).toBeLessThan(0);

        expect(client.paymentMethods.length).toBeGreaterThanOrEqual(1);
        const pm = client.paymentMethods[0];
        expect(pm.card_number_masked).toMatch(/^\*\*\*\* \*\*\*\* \*\*\*\* \d{4}$/);
        expect(pm.cardholder_name).toBeDefined();

        const decryptedCard = decrypt(pm.encrypted_card_number);
        expect(decryptedCard).toBeDefined();
        expect(decryptedCard.length).toBeGreaterThanOrEqual(15);
      }
    });

    it('cada trabajador debe tener perfil dual, certificaciones aprobadas y disponibilidad', () => {
      for (const worker of testWorkers) {
        expect(worker.clientProfile.full_name).toBe(
          worker.user.email.split('@')[0] === 'worker1'
            ? 'Roberto Fernández'
            : worker.workerProfile.full_name,
        );
        expect(worker.workerProfile.category_id).toBeDefined();
        expect(worker.workerProfile.hourly_rate).toBeGreaterThan(0);
        expect(worker.workerProfile.certification_status).toBe('APPROVED');
        expect(worker.workerProfile.availability_status).toBe('AVAILABLE');

        expect(worker.certifications.length).toBeGreaterThanOrEqual(1);
        for (const cert of worker.certifications) {
          expect(cert.verification_status).toBe('APPROVED');
        }
      }
    });
  });

  describe('03_orders_and_escrow.js - Sample Orders in multiple states', () => {
    it('debe contener órdenes en estados PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED, REJECTED', () => {
      const statuses = sampleOrders.map((o) => o.order.status);
      expect(statuses).toContain('PENDING');
      expect(statuses).toContain('ACCEPTED');
      expect(statuses).toContain('IN_PROGRESS');
      expect(statuses).toContain('COMPLETED');
      expect(statuses).toContain('CANCELLED');
      expect(statuses).toContain('REJECTED');
    });

    it('las órdenes ACCEPTED e IN_PROGRESS deben tener transacciones en estado ESCROWED', () => {
      const escrowOrders = sampleOrders.filter((o) =>
        ['ACCEPTED', 'IN_PROGRESS'].includes(o.order.status),
      );
      for (const o of escrowOrders) {
        expect(o.transaction).toBeDefined();
        expect(o.transaction.status).toBe('ESCROWED');
      }
    });

    it('las órdenes COMPLETED deben tener confirmación bilateral y transacciones en estado COMPLETED', () => {
      const completedOrders = sampleOrders.filter((o) => o.order.status === 'COMPLETED');
      for (const o of completedOrders) {
        expect(o.order.client_confirmed).toBe(true);
        expect(o.order.worker_confirmed).toBe(true);
        expect(o.transaction.status).toBe('COMPLETED');
      }
    });
  });

  describe('04_ratings_and_chats.js - Ratings, Reviews & Chats', () => {
    it('debe contener ratings y reviews con puntuaciones válidas', () => {
      expect(sampleRatings.length).toBeGreaterThanOrEqual(2);
      for (const r of sampleRatings) {
        expect(r.rating_stars).toBeGreaterThanOrEqual(1);
        expect(r.rating_stars).toBeLessThanOrEqual(5);
        expect(typeof r.review_text).toBe('string');
      }
    });

    it('debe contener chats y mensajes entre participantes', () => {
      expect(sampleChats.length).toBeGreaterThanOrEqual(1);
      const chat = sampleChats[0];
      expect(chat.participants.length).toBe(2);
      expect(chat.messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('clear.js - Database Reset Functionality', () => {
    it('la función clearDatabase debe ejecutar todas las eliminaciones en transacción', async () => {
      const deletedTables = [];
      const mockTrx = (table) => ({
        del: jest.fn().mockImplementation(() => {
          deletedTables.push(table);
          return Promise.resolve(1);
        }),
        update: jest.fn().mockResolvedValue(1),
      });

      const mockKnex = {
        transaction: jest.fn().mockImplementation(async (callback) => {
          await callback(mockTrx);
        }),
      };

      await clearDatabase(mockKnex);

      expect(mockKnex.transaction).toHaveBeenCalled();
      expect(deletedTables).toContain('disputes');
      expect(deletedTables).toContain('ratings');
      expect(deletedTables).toContain('orders');
      expect(deletedTables).toContain('users');
      expect(deletedTables).toContain('categories');
    });
  });
});
