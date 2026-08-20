import logger from '../utils/logger.js';

class AlertService {
  /**
   * Dispara una alerta crítica. Loguea en formato estructurado y
   * envía un webhook a Slack si la URL está configurada en .env.
   */
  async triggerAlert(type, message, metadata = {}) {
    // 1. Loguear la alerta
    logger.error(`[ALERTA] [${type}] ${message}`, {
      alert_type: type,
      alert_metadata: metadata,
      timestamp: new Date().toISOString(),
    });

    // 2. Intentar enviar notificación a Slack si está configurada
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (
      slackUrl &&
      !slackUrl.includes('tu_webhook_aqui') &&
      !slackUrl.includes('YOUR_SLACK_WEBHOOK_URL')
    ) {
      try {
        const payload = {
          text: `🚨 *ALERTA CRÍTICA DETECTADA* 🚨\n*Tipo:* ${type}\n*Mensaje:* ${message}\n*Metadata:* \`\`\`${JSON.stringify(metadata, null, 2)}\`\`\``,
        };

        // Uso de fetch nativo de Node.js (disponible en Node 18+)
        fetch(slackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch((err) => {
          logger.error('Error asíncrono al enviar alerta a Slack:', err.message);
        });
      } catch (err) {
        logger.error('Error al iniciar envío de alerta a Slack:', err.message);
      }
    }
  }
}

export default new AlertService();
