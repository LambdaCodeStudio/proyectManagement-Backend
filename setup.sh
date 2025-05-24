#!/bin/bash

# Script para configurar el sistema de pagos con Mercado Pago

echo "🚀 Iniciando configuración del sistema de pagos..."

# Crear directorios necesarios
echo "📁 Verificando estructura de directorios..."

for dir in models controllers services routes utils; do
  if [ ! -d "$dir" ]; then
    mkdir "$dir"
    echo "✅ Carpeta '$dir' creada."
  else
    echo "⚠️  Carpeta '$dir' ya existe, se omite."
  fi
done

# Crear archivos del sistema

declare -A files=(
  ["models/debt.js"]=""
  ["models/payment.js"]=""
  ["controllers/debt.js"]=""
  ["controllers/payment.js"]=""
  ["controllers/mercadopago.js"]=""
  ["services/mercadopago.js"]=""
  ["routes/debt.js"]=""
  ["routes/payment.js"]=""
  ["routes/mercadopago.js"]=""
  ["utils/constants.js"]=""
)

echo "📝 Verificando archivos..."

for file in "${!files[@]}"; do
  if [ ! -f "$file" ]; then
    touch "$file"
    echo "✅ Archivo '$file' creado."
  else
    echo "⚠️  Archivo '$file' ya existe, se omite."
  fi
done

# Instalar dependencias
echo "📦 Instalando dependencias necesarias..."
npm install mercadopago@2.0.15
npm install uuid
npm install express-validator
npm install date-fns

# Crear archivo de ejemplo de variables de entorno si no existe
ENV_EXAMPLE=".env.example"
if [ ! -f "$ENV_EXAMPLE" ]; then
  echo "🔐 Creando archivo de ejemplo para variables de entorno..."
  cat << 'EOF' > "$ENV_EXAMPLE"

# Mercado Pago Configuration
MP_ACCESS_TOKEN=TEST-YOUR-ACCESS-TOKEN-HERE
MP_PUBLIC_KEY=TEST-YOUR-PUBLIC-KEY-HERE
MP_WEBHOOK_SECRET=your-webhook-secret-here

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Payment Configuration
PAYMENT_SUCCESS_URL=http://localhost:3000/payments/success
PAYMENT_FAILURE_URL=http://localhost:3000/payments/failure
PAYMENT_PENDING_URL=http://localhost:3000/payments/pending

EOF
  echo "✅ Archivo '$ENV_EXAMPLE' creado."
else
  echo "⚠️  Archivo '$ENV_EXAMPLE' ya existe, se omite."
fi

echo "✅ Configuración completada!"
echo ""
echo "⚠️  IMPORTANTE:"
echo "1. Copia las credenciales de Mercado Pago en el archivo .env"
echo "2. Configura las URLs de retorno según tu frontend"
echo "3. Ejecuta 'npm start' para iniciar el servidor"
echo ""
echo "📚 Documentación:"
echo "- Credenciales de prueba: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test"
echo "- Webhooks: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/notifications"
