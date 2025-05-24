# 💳 Sistema de Pagos con Mercado Pago - Documentación

## 📋 Índice
1. [Configuración Inicial](#configuración-inicial)
2. [Variables de Entorno](#variables-de-entorno)
3. [Modelos de Datos](#modelos-de-datos)
4. [API Endpoints](#api-endpoints)
5. [Flujo de Pago](#flujo-de-pago)
6. [Webhooks](#webhooks)
7. [Testing](#testing)
8. [Producción](#producción)

## 🚀 Configuración Inicial

### 1. Instalar el sistema

```bash
# Ejecutar el script de instalación
chmod +x setup-payment-system.sh
./setup-payment-system.sh
```

### 2. Configurar Mercado Pago

1. Crear una cuenta en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
2. Crear una aplicación nueva
3. Obtener las credenciales (Access Token y Public Key)
4. Configurar los webhooks en tu aplicación

### 3. Configurar variables de entorno

Copiar `.env.example` a `.env` y completar:

```env
# Mercado Pago Configuration
MP_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxx
MP_PUBLIC_KEY=APP_USR-xxxxxxxxxxxxx
MP_WEBHOOK_SECRET=tu-secret-webhook

# Frontend URL
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000

# Payment URLs
PAYMENT_SUCCESS_URL=http://localhost:3000/payments/success
PAYMENT_FAILURE_URL=http://localhost:3000/payments/failure
PAYMENT_PENDING_URL=http://localhost:3000/payments/pending

# Statement descriptor (aparece en el resumen de tarjeta)
MP_STATEMENT_DESCRIPTOR=MIPAGO
```

## 📊 Modelos de Datos

### Debt (Deuda)
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  description: String,
  amount: Number,
  currency: String (ARS/USD),
  status: String (pending/processing/paid/cancelled/overdue),
  dueDate: Date,
  category: String,
  payments: [ObjectId] (ref: Payment),
  createdAt: Date,
  updatedAt: Date
}
```

### Payment (Pago)
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  debt: ObjectId (ref: Debt),
  amount: Number,
  currency: String,
  status: String,
  mercadopago: {
    preferenceId: String,
    paymentId: String,
    externalReference: String,
    // ... más datos de MP
  },
  createdAt: Date,
  updatedAt: Date
}
```

## 🔌 API Endpoints

### Autenticación
Todos los endpoints (excepto webhooks) requieren autenticación JWT:
```
Authorization: Bearer <token>
```

### 📋 Endpoints de Deudas

#### Obtener deudas del usuario
```http
GET /api/debts
Query params:
  - status: pending|processing|paid|cancelled|overdue
  - overdue: true|false
  - page: number (default: 1)
  - limit: number (default: 10, max: 100)

Response:
{
  "status": "success",
  "data": {
    "debts": [...],
    "pagination": {...},
    "summary": {
      "totalAmount": 5000,
      "totalDebts": 3
    }
  }
}
```

#### Obtener una deuda específica
```http
GET /api/debts/:id

Response:
{
  "status": "success",
  "data": {
    "_id": "...",
    "description": "Servicio mensual",
    "amount": 1500,
    "status": "pending",
    "dueDate": "2024-12-31",
    "canBePaid": true,
    "totalPaid": 0
  }
}
```

#### Obtener estadísticas
```http
GET /api/debts/stats

Response:
{
  "status": "success",
  "data": {
    "statusBreakdown": [...],
    "totalDebts": 10,
    "totalAmount": 15000,
    "upcomingDebts": 3
  }
}
```

### 💳 Endpoints de Pagos

#### Crear preferencia de pago
```http
POST /api/payments/preference/:debtId

Response:
{
  "status": "success",
  "data": {
    "preferenceId": "xxx-xxx-xxx",
    "initPoint": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=xxx",
    "sandboxInitPoint": "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=xxx",
    "expirationDate": "2024-01-02T00:00:00.000Z",
    "paymentId": "xxx"
  }
}
```

#### Obtener historial de pagos
```http
GET /api/payments
Query params:
  - status: pending|processing|approved|rejected|cancelled
  - debtId: ObjectId
  - page: number
  - limit: number

Response:
{
  "status": "success",
  "data": {
    "payments": [...],
    "pagination": {...},
    "stats": {
      "totalPayments": 15,
      "totalAmount": 25000
    }
  }
}
```

#### Verificar estado de pago
```http
GET /api/payments/status/check?external_reference=xxx&payment_id=xxx&status=approved

Response:
{
  "status": "success",
  "data": {
    "payment": {
      "id": "xxx",
      "status": "approved",
      "amount": 1500
    },
    "debt": {
      "id": "xxx",
      "status": "paid"
    }
  }
}
```

#### Cancelar pago
```http
POST /api/payments/:id/cancel
Body:
{
  "reason": "Usuario canceló el pago"
}
```

#### Reintentar pago
```http
POST /api/payments/:id/retry
```

#### Solicitar reembolso
```http
POST /api/payments/:id/refund
Body:
{
  "reason": "Motivo del reembolso",
  "amount": 1000 // opcional, por defecto total
}
```

### 🔔 Endpoints de Webhooks

#### Webhook principal (configurar en MP)
```http
POST /api/mercadopago/webhook
```

#### Verificar estado del webhook
```http
GET /api/mercadopago/webhook/health
```

## 💰 Flujo de Pago

### 1. Usuario selecciona deuda a pagar
```javascript
// Frontend
const debt = await api.get('/api/debts/123');
```

### 2. Crear preferencia de pago
```javascript
const { data } = await api.post(`/api/payments/preference/${debtId}`);
const { initPoint, preferenceId } = data.data;
```

### 3. Redirigir a Mercado Pago
```javascript
// Opción 1: Redirección
window.location.href = initPoint;

// Opción 2: Modal (con SDK de MP)
const mp = new MercadoPago('PUBLIC_KEY');
const checkout = mp.checkout({
  preference: { id: preferenceId }
});
checkout.open();
```

### 4. Usuario completa el pago en MP

### 5. MP redirige según resultado
- Éxito: `PAYMENT_SUCCESS_URL?external_reference=xxx&payment_id=xxx`
- Error: `PAYMENT_FAILURE_URL?external_reference=xxx`
- Pendiente: `PAYMENT_PENDING_URL?external_reference=xxx`

### 6. Frontend verifica estado
```javascript
const params = new URLSearchParams(window.location.search);
const externalReference = params.get('external_reference');

const { data } = await api.get('/api/payments/status/check', {
  params: {
    external_reference: externalReference,
    payment_id: params.get('payment_id'),
    status: params.get('status')
  }
});
```

## 🔔 Webhooks

### Configuración en Mercado Pago

1. Ir a tu aplicación en MP Developers
2. Configurar Webhooks/IPN
3. URL: `https://tu-dominio.com/api/mercadopago/webhook`
4. Eventos a escuchar:
   - Payment
   - Merchant Order (opcional)

### Procesamiento de Webhooks

El sistema procesa automáticamente:
- Actualización de estado de pagos
- Marcado de deudas como pagadas
- Registro de historial

### Testing de Webhooks en desarrollo

Usar [ngrok](https://ngrok.com/) para exponer localhost:

```bash
ngrok http 4000
```

Configurar la URL de ngrok en MP:
```
https://xxx.ngrok.io/api/mercadopago/webhook
```

## 🧪 Testing

### Tarjetas de prueba

| Tarjeta | Número | CVV | Vencimiento |
|---------|---------|-----|-------------|
| Mastercard (aprobada) | 5031 7557 3453 0604 | 123 | 11/25 |
| Visa (aprobada) | 4509 9535 6623 3704 | 123 | 11/25 |
| Amex (aprobada) | 3711 803032 57522 | 1234 | 11/25 |

### Usuarios de prueba

Crear en MP Developers:
- Usuario vendedor (recibe pagos)
- Usuario comprador (realiza pagos)

### Simular webhook
```bash
curl -X POST http://localhost:4000/api/mercadopago/webhook/test \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "123456789",
    "status": "approved"
  }'
```

## 🚀 Producción

### Checklist

- [ ] Cambiar credenciales de MP a producción
- [ ] Configurar HTTPS obligatorio
- [ ] Configurar URLs de retorno de producción
- [ ] Habilitar logs de producción
- [ ] Configurar backups de BD
- [ ] Monitoreo de webhooks
- [ ] Rate limiting ajustado
- [ ] Alertas de errores

### Variables de entorno adicionales

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=<strong-secret>
JWT_SECRET=<strong-secret>
```

### Seguridad

1. **HTTPS obligatorio**
2. **Validar origen de webhooks**
3. **Rate limiting estricto**
4. **Logs de auditoría**
5. **Encriptación de datos sensibles**

## 📞 Soporte

### Errores comunes

1. **"Preference creation failed"**
   - Verificar Access Token
   - Verificar formato de datos

2. **"Webhook not received"**
   - Verificar URL configurada
   - Revisar logs del servidor

3. **"Payment not updating"**
   - Verificar procesamiento de webhooks
   - Revisar external_reference

### Recursos

- [Documentación MP](https://www.mercadopago.com.ar/developers/es/docs)
- [API Reference](https://www.mercadopago.com.ar/developers/es/reference)
- [SDKs](https://github.com/mercadopago)

---

## 📄 Licencia

Este sistema está protegido por derechos de autor. Uso autorizado únicamente.