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
          createdAt: user.createdAt
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

module.exports = { register, login, getCurrentUser };