import { Router } from 'express';
import paymentController from '../controllers/PaymentController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Pagos
 *   description: Procesamiento de transacciones reales e integración con Stripe
 */

/**
 * @openapi
 * /payments/process:
 *   post:
 *     summary: Iniciar el proceso de pago de una orden
 *     description: |
 *       Crea y confirma una intención de pago en Stripe utilizando el método de pago especificado.
 *       Maneja flujos tanto de confirmación directa (síncrona) como de requerimiento de acción adicional (redirigir para 3D Secure).
 *     tags: [Pagos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_id, payment_method_id, amount]
 *             properties:
 *               order_id:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *                 description: UUID de la orden a pagar
 *               payment_method_id:
 *                 type: string
 *                 format: uuid
 *                 example: "987f6543-e21b-32d3-b456-526614174999"
 *                 description: UUID del método de pago guardado del usuario
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 150.00
 *                 description: Monto total a cobrar
 *     responses:
 *       200:
 *         description: Pago completado exitosamente o requiere validación 3D Secure
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [succeeded, requires_action]
 *                   example: "succeeded"
 *                 client_secret:
 *                   type: string
 *                   example: "pi_123_secret_abc"
 *                   description: Solo si status es 'requires_action'
 *                 next_action:
 *                   type: object
 *                   description: Datos adicionales de redirección si requiere acción
 *       400:
 *         description: Error de validación en los campos enviados
 *       401:
 *         description: No autenticado
 *       402:
 *         description: Pago rechazado (tarjeta declinada)
 *       403:
 *         description: No autorizado para pagar la orden
 *       404:
 *         description: Orden o método de pago no encontrado
 *       409:
 *         description: Conflicto - El pago para la orden ya ha sido iniciado o completado
 *       500:
 *         description: Error interno al procesar el cobro
 */
router.post('/payments/process', authenticateToken, paymentController.process);

/**
 * @openapi
 * /webhooks/payment:
 *   post:
 *     summary: Receptor de webhooks de eventos de Stripe
 *     description: |
 *       Procesa eventos asíncronos enviados por Stripe (como 'payment_intent.succeeded' o 'payment_intent.payment_failed').
 *       Verifica la autenticidad del evento mediante la validación de la firma en la cabecera 'stripe-signature'.
 *       Si el pago tiene éxito, la transacción local se actualiza a 'ESCROWED'. Si falla, la transacción pasa a 'FAILED' y la orden se cancela.
 *     tags: [Pagos]
 *     parameters:
 *       - in: header
 *         name: stripe-signature
 *         required: true
 *         schema:
 *           type: string
 *         description: Firma de verificación generada por Stripe
 *     responses:
 *       200:
 *         description: Evento recibido y procesado correctamente
 *       400:
 *         description: Firma inválida o formato incorrecto del webhook
 *       500:
 *         description: Error interno al actualizar el estado de la transacción
 */
router.post('/webhooks/payment', paymentController.stripeWebhook);

export default router;
