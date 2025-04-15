/**
 * Utilidad para el registro de logs de la aplicación
 */

// Función para registrar información
exports.logInfo = (message, data = null) => {
    console.log(`[INFO] ${message}`, data ? data : '');
  };
  
  // Función para registrar errores
  exports.logError = (message, error = null) => {
    console.error(`[ERROR] ${message}`, error ? error : '');
    
    // Aquí podrías implementar una lógica más avanzada como:
    // - Enviar notificaciones a Slack/Discord/Email en producción
    // - Guardar los errores en una base de datos
    // - Integrar con servicios como Sentry, LogRocket, etc.
  };
  
  // Función para registrar advertencias
  exports.logWarning = (message, data = null) => {
    console.warn(`[WARNING] ${message}`, data ? data : '');
  };
  
  // Función para registrar actividad sospechosa o de seguridad
  exports.logSecurity = (message, req = null) => {
    const details = req ? {
      ip: req.ip,
      method: req.method,
      path: req.path,
      headers: req.headers,
      requestId: req.requestId
    } : null;
    
    console.warn(`[SECURITY] ${message}`, details ? details : '');
    
    // En producción aquí podrías:
    // - Registrar en una colección separada de MongoDB
    // - Enviar alertas a los administradores
    // - Incrementar contadores para sistemas de banning automático
  };
  
  // Función para registrar actividad de negocio importante
  exports.logBusiness = (message, data = null) => {
    console.log(`[BUSINESS] ${message}`, data ? data : '');
    
    // En producción aquí podrías:
    // - Registrar en analytics
    // - Agregar a métricas de negocio
  };