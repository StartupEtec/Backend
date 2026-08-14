import { Router } from 'express';
import paymentController from '../controllers/PaymentController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Métodos de Pago
 *   description: Gestión de tarjetas de crédito/débito para pagos de clientes
 */

/**
 * @openapi
 * /users/{id}/payment-methods:
 *   post:
 *     summary: Agregar un método de pago
 *     description: |
 *       Crea y asocia un nuevo método de pago (tarjeta de crédito/débito) a la cuenta del usuario.
 *       Valida el número de tarjeta usando el algoritmo de Luhn, enmascara el número mostrando solo los últimos 4 dígitos
 *       y encripta la tarjeta de forma segura usando AES-256-CBC. El CVV no se almacena en el sistema.
 *       El usuario puede tener un máximo de 10 métodos de pago guardados.
 *     tags: [Métodos de Pago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [card_number, cvv, exp_month, exp_year, cardholder_name]
 *             properties:
 *               card_number:
 *                 type: string
 *                 pattern: '^\d{13,19}$'
 *                 example: "4000123456789010"
 *                 description: Número de la tarjeta (13-19 dígitos)
 *               cvv:
 *                 type: string
 *                 pattern: '^\d{3,4}$'
 *                 example: "123"
 *                 description: Código de seguridad (3-4 dígitos)
 *               exp_month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *                 example: 12
 *                 description: Mes de expiración (1-12)
 *               exp_year:
 *                 type: integer
 *                 example: 2030
 *                 description: Año de expiración (cuatro dígitos)
 *               cardholder_name:
 *                 type: string
 *                 example: "Juan Pérez"
 *                 description: Nombre del titular de la tarjeta
 *               is_primary:
 *                 type: boolean
 *                 default: false
 *                 description: Define si es el método de pago por defecto
 *     responses:
 *       201:
 *         description: Método de pago creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Método de pago agregado correctamente
 *                 payment_method:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     user_id: { type: string, format: uuid }
 *                     card_number_masked: { type: string, example: "**** **** **** 9010" }
 *                     card_brand: { type: string, example: "Visa" }
 *                     exp_month: { type: integer, example: 12 }
 *                     exp_year: { type: integer, example: 2030 }
 *                     cardholder_name: { type: string, example: "Juan Pérez" }
 *                     is_primary: { type: boolean, example: true }
 *                     created_at: { type: string, format: date-time }
 *                     updated_at: { type: string, format: date-time }
 *       400:
 *         description: Error de validación o límite de tarjetas excedido
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado
 *
 *   get:
 *     summary: Listar los métodos de pago de un usuario
 *     description: Obtiene la lista de métodos de pago guardados de un usuario autenticado. Los números de tarjeta se devuelven enmascarados.
 *     tags: [Métodos de Pago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del usuario
 *     responses:
 *       200:
 *         description: Lista de métodos de pago devuelta con éxito
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payment_methods:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       user_id: { type: string, format: uuid }
 *                       card_number_masked: { type: string, example: "**** **** **** 9010" }
 *                       card_brand: { type: string, example: "Visa" }
 *                       exp_month: { type: integer, example: 12 }
 *                       exp_year: { type: integer, example: 2030 }
 *                       cardholder_name: { type: string, example: "Juan Pérez" }
 *                       is_primary: { type: boolean, example: true }
 *                       created_at: { type: string, format: date-time }
 *                       updated_at: { type: string, format: date-time }
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado
 */

/**
 * @openapi
 * /payment-methods/{id}:
 *   patch:
 *     summary: Actualizar un método de pago
 *     description: Actualiza la fecha de expiración, el nombre del titular o el estado predeterminado de una tarjeta específica.
 *     tags: [Métodos de Pago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del método de pago
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               exp_month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *                 example: 12
 *               exp_year:
 *                 type: integer
 *                 example: 2031
 *               cardholder_name:
 *                 type: string
 *                 example: "Juan Pérez Modificado"
 *               is_primary:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Método de pago actualizado correctamente
 *       400:
 *         description: Error de validación
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Método de pago no encontrado
 *
 *   delete:
 *     summary: Eliminar un método de pago
 *     description: Elimina de forma lógica o física un método de pago, siempre y cuando no existan transacciones pendientes asociadas al mismo.
 *     tags: [Métodos de Pago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del método de pago
 *     responses:
 *       200:
 *         description: Método de pago eliminado correctamente
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Método de pago no encontrado
 *       409:
 *         description: Conflicto - Transacciones pendientes asociadas al método de pago
 */
router.patch('/:id', authenticateToken, paymentController.update);
router.delete('/:id', authenticateToken, paymentController.delete);

export default router;
