/**
 * Middleware para autorización basada en roles
 * Permite verificar si un usuario tiene los roles necesarios para acceder a un recurso
 */

// Middleware para verificar roles
const checkRole = (roles) => {
  return (req, res, next) => {
    // Si no hay usuario autenticado o no tiene rol, denegar acceso
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        status: 'error',
        message: 'Acceso denegado: no tiene permisos suficientes'
      });
    }

    // Si el rol del usuario está en la lista de roles permitidos, permitir acceso
    if (roles.includes(req.user.role)) {
      return next();
    }

    // Si el rol no está permitido, denegar acceso
    return res.status(403).json({
      status: 'error',
      message: 'Acceso denegado: se requieren permisos especiales'
    });
  };
};

// Middleware para verificar si es admin
const isAdmin = checkRole(['admin']);

// Middleware para verificar si es cliente
const isCliente = checkRole(['cliente']);

// Middleware para verificar si es admin o cliente
const isAdminOrCliente = checkRole(['admin', 'cliente']);

// Middleware para verificar si es propietario del recurso o admin
const isOwnerOrAdmin = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      // Si no hay usuario autenticado, denegar acceso
      if (!req.user) {
        return res.status(403).json({
          status: 'error',
          message: 'Acceso denegado: autenticación requerida'
        });
      }

      // Si es admin, permitir acceso
      if (req.user.role === 'admin') {
        return next();
      }

      // Obtener el ID del propietario del recurso
      const ownerId = await getResourceOwnerId(req);

      // Si el usuario es el propietario, permitir acceso
      if (ownerId && ownerId.toString() === req.user.userId.toString()) {
        return next();
      }

      // Si no es propietario ni admin, denegar acceso
      return res.status(403).json({
        status: 'error',
        message: 'Acceso denegado: no es propietario del recurso'
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Error al verificar permisos',
        details: error.message
      });
    }
  };
};

module.exports = {
  checkRole,
  isAdmin,
  isCliente,
  isAdminOrCliente,
  isOwnerOrAdmin
};
