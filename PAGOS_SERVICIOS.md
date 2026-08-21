# Pagos y renovaciones de servicios — VIP Fitness

Última revisión: **8 de agosto de 2026**

> Este inventario ahora se administra desde **Más → Gastos de la app**. La
> sección guarda montos estimados, vencimientos, avisos anticipados e historial
> de pagos. Requiere la migración `0070_gastos_app.sql`.

Este archivo no debe contener contraseñas, tokens, números de tarjeta ni claves API.
Su objetivo es evitar suspensiones inesperadas y registrar qué depende de cada proveedor.

## Calendario confirmado

### Cloudflare Stream — Starter Bundle

- Estado: **activo y pagado**.
- Activación: **8 de agosto de 2026**.
- Renovación estimada: **día 8 de cada mes, en UTC**.
- Precio base observado al contratar: **USD 5/mes**, más cualquier exceso de uso.
- Incluye: 1.000 minutos almacenados y 5.000 minutos entregados al mes.
- Recordatorio recomendado: revisar el método de pago el **día 5 de cada mes**.
- Segundo aviso: comprobar la factura y el uso el **día 7 de cada mes**.
- Panel: Cloudflare → Manage Account → Billing → Subscriptions.
- Uso en la aplicación: carga, procesamiento y reproducción de clips de ejercicios.
- Si el pago falla: hay un período de gracia; Stream puede dejar de funcionar después.
- Si no se renueva: Cloudflare informa que los videos se eliminan después de 30 días.
- Antes de cancelar: respaldar todos los videos importantes fuera de Stream.

## Servicios que deben revisarse y completar

| Servicio | Uso en VIP Fitness | Plan/cobro actual | Próxima fecha | Qué ocurre si se suspende |
|---|---|---:|---:|---|
| Vercel | Hosting, funciones y cron | **Por confirmar** | **Por confirmar** | La web o funciones pueden quedar limitadas o fuera de línea. |
| Supabase | Base de datos, usuarios y archivos | **Por confirmar** | **Por confirmar** | Login, datos, fotos y operaciones principales pueden fallar. |
| Dominio `vipfitness.cl` | Dirección pública de la aplicación | Registrador **NIC Chile** (registrante: Alejandro Mendoza Galíndez) | **28 de julio de 2027** | El dominio deja de dirigir a la aplicación. |
| Anthropic API | Asistente de IA | Cobro por consumo **por confirmar** | Sin renovación fija conocida | El asistente deja de responder; el resto de la app debería continuar. |
| Resend | Correos transaccionales | Plan **por confirmar** | **Por confirmar** | Los correos de la aplicación dejan de enviarse. |
| GitHub | Repositorio privado | Plan **por confirmar** | **Por confirmar** | Puede afectar colaboración o automatizaciones, no la web ya desplegada. |
| Cloudflare DNS | DNS de `vipfitness.cl` | Normalmente gratuito; verificar cuenta | Sin fecha conocida | Un cambio o suspensión de cuenta puede afectar la resolución del dominio. |

## Revisión mensual recomendada

Realizar esta lista el **día 5 de cada mes**:

- [ ] Cloudflare: confirmar tarjeta vigente, factura y consumo de Stream.
- [ ] Vercel: revisar Usage y Billing; confirmar que no hay avisos de límite.
- [ ] Supabase: revisar Usage y Billing; confirmar base de datos y Storage.
- [ ] Anthropic: revisar saldo/límite mensual y consumo del asistente.
- [ ] Resend: revisar cuota de correos y estado del dominio remitente.
- [ ] Verificar que `vipfitness.cl` no esté próximo a vencer.
- [ ] Descargar y archivar las facturas del mes.
- [ ] Registrar en este archivo cualquier cambio de plan, precio o fecha.

## Revisión anual recomendada

El **1 de julio de cada año**:

- [ ] Confirmar registrador, fecha de expiración y renovación automática de `vipfitness.cl`.
- [ ] Confirmar que el correo y la tarjeta de facturación sigan vigentes.
- [ ] Descargar un respaldo de la base de datos.
- [ ] Mantener una copia externa de los videos originales.
- [ ] Evaluar reemplazar Cloudflare Stream por almacenamiento y reproducción propios.

## Datos pendientes de completar

Abrir cada panel de facturación y reemplazar los campos **Por confirmar**:

- Vercel: plan, importe, ciclo y próxima factura.
- Supabase: plan, importe, ciclo y próxima factura.
- Registrador de `vipfitness.cl`: confirmado NIC Chile, vence 28/07/2027 (falta el precio anual).
- Cuenta de Cloudflare que tiene la zona DNS de `vipfitness.cl`: la cuenta `Alealemenmen@gm...` NO la tiene — hay que ubicar con qué otro correo se configuró.
- Anthropic: límite de gasto mensual configurado.
- Resend: plan y límite mensual.
- GitHub: plan y fecha de cobro, si corresponde.

## Historial

| Fecha | Cambio |
|---|---|
| 2026-08-08 | Se activó Cloudflare Stream Starter Bundle por USD 5/mes. |
| 2026-08-18 | Confirmado por WHOIS de NIC Chile: registrador NIC Chile, registrante Alejandro Mendoza Galíndez, vence 28/07/2027. Detectado que la cuenta de Cloudflare usada para revisar Stream no tiene la zona DNS de `vipfitness.cl` — falta ubicar la cuenta correcta. |

