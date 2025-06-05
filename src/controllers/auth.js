const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  try {
    // Por defecto, los nuevos usuarios son clientes a menos que se especifique
    const userData = { ...req.body };
    if (!userData.role) {
      userData.role = 'cliente';
    }
    
    // Solo los admins pueden crear otros admins
    if (userData.role === 'admin' && (!req.user || req.user.role !== 'admin')) {
      return res.status(403).json({
        status: 'error',
        message: 'No tiene permisos para crear usuarios administradores'
      });
    }
    
    const user = new User(userData);
    await user.save();
    
    // Incluir role e id en el token
    const token = jwt.sign({ 
      userId: user._id, 
      email: user.email,
      role: user.role 
    }, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    res.json({ 
      status: 'success',
      message: 'Usuario registrado exitosamente',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          name: user.name
        }
      }
    });
  } catch (error) {
    res.status(400).json({ 
      status: 'error',
      message: error.message 
    });
  }
};

const login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Usuario no existe' 
      });
    }

    // Verificar si la cuenta está activa
    if (user.active === false) {
      return res.status(403).json({
        status: 'error',
        message: 'Esta cuenta ha sido desactivada. Contacte al administrador.'
      });
    }

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Contraseña incorrecta' 
      });
    }

    // Actualizar último login
    user.lastLogin = new Date();
    await user.save();

    // Incluir role e id en el token
    const token = jwt.sign({ 
      userId: user._id, 
      email: user.email,
      role: user.role 
    }, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    res.json({ 
      status: 'success',
      message: 'Inicio de sesión exitoso',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          name: user.name
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: error.message 
    });
  }
};

// Obtener información del usuario actual
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          name: user.name,
          phone: user.phone,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          active: user.active
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Obtener lista de usuarios (solo admin)
const getUsers = async (req, res) => {
  try {
    const { role, active, page = 1, limit = 10, search } = req.query;
    
    // Construir filtros
    const filters = {};
    if (role && role !== 'all') {
      filters.role = role;
    }
    if (active !== undefined) {
      filters.active = active === 'true';
    }
    if (search) {
      filters.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Paginación
    const skip = (page - 1) * limit;
    
    // Obtener usuarios
    const [users, total] = await Promise.all([
      User.find(filters)
        .select('-password')
        .sort('-createdAt')
        .limit(limit * 1)
        .skip(skip)
        .lean(),
      User.countDocuments(filters)
    ]);
    
    res.json({
      status: 'success',
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los usuarios'
    });
  }
};

// Obtener un usuario específico (solo admin)
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('-password').lean();
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener el usuario'
    });
  }
};

// Crear nuevo usuario (solo admin)
const createUser = async (req, res) => {
  try {
    const userData = { ...req.body };
    
    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'El email ya está registrado'
      });
    }
    
    const user = new User(userData);
    await user.save();
    
    // Devolver usuario sin contraseña
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(201).json({
      status: 'success',
      message: 'Usuario creado exitosamente',
      data: {
        user: userResponse
      }
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Actualizar usuario (admin o propio usuario)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    
    // Verificar permisos: admin puede editar cualquier usuario, usuarios pueden editar su propia información
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      return res.status(403).json({
        status: 'error',
        message: 'No tiene permisos para editar este usuario'
      });
    }
    
    // Solo admin puede cambiar roles
    if (updates.role && req.user.role !== 'admin') {
      delete updates.role;
    }
    
    // Solo admin puede cambiar estado activo
    if (updates.active !== undefined && req.user.role !== 'admin') {
      delete updates.active;
    }
    
    // Si se está actualizando la contraseña, hashearla
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    
    // Eliminar campos que no se pueden actualizar
    delete updates._id;
    delete updates.createdAt;
    delete updates.lastLogin;
    
    const user = await User.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      status: 'success',
      message: 'Usuario actualizado exitosamente',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Desactivar/activar usuario (solo admin)
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    // No permitir que el admin se desactive a sí mismo
    if (req.user.userId === id && active === false) {
      return res.status(400).json({
        status: 'error',
        message: 'No puede desactivar su propia cuenta'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      id,
      { active },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      status: 'success',
      message: `Usuario ${active ? 'activado' : 'desactivado'} exitosamente`,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error cambiando estado del usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al cambiar el estado del usuario'
    });
  }
};

// Eliminar usuario (solo admin - soft delete)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // No permitir que el admin se elimine a sí mismo
    if (req.user.userId === id) {
      return res.status(400).json({
        status: 'error',
        message: 'No puede eliminar su propia cuenta'
      });
    }
    
    // Verificar si el usuario tiene deudas activas
    const Debt = require('../models/debt');
    const activeDebts = await Debt.countDocuments({
      user: id,
      status: { $in: ['pending', 'overdue', 'processing'] }
    });
    
    if (activeDebts > 0) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede eliminar el usuario porque tiene ${activeDebts} deuda(s) activa(s)`
      });
    }
    
    // Desactivar usuario en lugar de eliminarlo (soft delete)
    const user = await User.findByIdAndUpdate(
      id,
      { 
        active: false,
        email: `deleted_${Date.now()}_${user.email}` // Marcar email como eliminado
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    res.json({
      status: 'success',
      message: 'Usuario eliminado exitosamente',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar el usuario'
    });
  }
};

// Obtener estadísticas de usuarios (solo admin)
const getUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: {
            $sum: {
              $cond: ['$active', 1, 0]
            }
          }
        }
      }
    ]);
    
    // Procesar estadísticas
    const result = {
      totalUsers: 0,
      totalActive: 0,
      admins: 0,
      activeAdmins: 0,
      clientes: 0,
      activeClientes: 0
    };
    
    stats.forEach(stat => {
      result.totalUsers += stat.count;
      result.totalActive += stat.active;
      
      if (stat._id === 'admin') {
        result.admins = stat.count;
        result.activeAdmins = stat.active;
      } else if (stat._id === 'cliente') {
        result.clientes = stat.count;
        result.activeClientes = stat.active;
      }
    });
    
    // Obtener usuarios registrados en los últimos 7 días
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    result.recentRegistrations = await User.countDocuments({
      createdAt: { $gte: lastWeek }
    });
    
    res.json({
      status: 'success',
      data: {
        ...result,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de usuarios:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las estadísticas'
    });
  }
};

// Cambiar contraseña
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;
    
    // Obtener usuario actual
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'La contraseña actual es incorrecta'
      });
    }
    
    // Actualizar contraseña
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    
    res.json({
      status: 'success',
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al cambiar la contraseña'
    });
  }
};

module.exports = { 
  register, 
  login, 
  getCurrentUser,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
  getUserStats,
  changePassword
};