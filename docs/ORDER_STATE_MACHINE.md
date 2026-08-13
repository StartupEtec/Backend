# Máquina de Estados de Órdenes

Este documento detalla los estados permitidos, las transiciones válidas y las reglas de negocio asociadas con el ciclo de vida de una orden (pedido de servicio) en la plataforma.

## Diagrama de Transición de Estados

```mermaid
stateDiagram-v2
    [*] --> PENDING : Creación de orden (o solicitud inicial)
    PENDING --> ACCEPTED : Aceptación de cotización (automatizada vía QuoteService)
    PENDING --> REJECTED : Rechazada por el Cliente
    ACCEPTED --> IN_PROGRESS : Iniciada por el Trabajador
    ACCEPTED --> CANCELLED : Cancelada por Cliente o Trabajador
    IN_PROGRESS --> COMPLETED : Completada por el Trabajador
    IN_PROGRESS --> CANCELLED : Cancelada por Cliente o Trabajador
    COMPLETED --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]
```

## Reglas de Transición y Actores

| Estado Inicial | Estado Destino | Actor Permitido | Descripción / Validación |
| :--- | :--- | :--- | :--- |
| `PENDING` | `ACCEPTED` | Automatizado / Cliente | Se gatilla únicamente cuando el cliente acepta una cotización activa asociada a la orden a través del `QuoteService`. |
| `PENDING` | `REJECTED` | Cliente | El cliente rechaza o cancela la solicitud inicial antes de que se acepte cualquier propuesta. |
| `ACCEPTED` | `IN_PROGRESS` | Trabajador | El trabajador asignado inicia el servicio formalmente. |
| `ACCEPTED` | `CANCELLED` | Cliente / Trabajador | Se cancela el servicio programado de común acuerdo o de manera unilateral antes de iniciar el trabajo. |
| `IN_PROGRESS` | `COMPLETED` | Trabajador | El trabajador marca el trabajo como terminado. |
| `IN_PROGRESS` | `CANCELLED` | Cliente / Trabajador | Cancelación durante la ejecución del servicio (puede requerir lógica de mediación posterior). |

## Auditoría y Eventos

Cada transición de estado exitosa se registra de forma atómica en la tabla `order_events` para mantener un historial inmutable de auditoría:
*   `id`: UUID Clave primaria.
*   `order_id`: UUID que asocia el evento a la orden.
*   `user_id`: UUID del actor (usuario autenticado) que ejecutó la transición.
*   `from_state`: Estado anterior de la orden.
*   `to_state`: Estado nuevo de la orden.
*   `created_at`: Fecha y hora del evento.

## Notificaciones en Tiempo Real

Al realizar una transición de estado, el sistema notifica automáticamente a los participantes (tanto cliente como trabajador) a través de WebSocket emitiendo el evento `order:status_changed` con el payload de la orden actualizada.
