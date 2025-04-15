const Cliente = require('../models/clienteSchema');
const crypto = require('crypto');

// Generar un nuevo token para un cliente
const generarToken = async (idCliente) => {
  try {
    const cliente = await Cliente.findById(idCliente);
    
    if (!cliente) {
      throw new Error(`Cliente con ID ${idCliente} no encontrado`);
    }
    
    // Generar un token aleatorio seguro
    const tokenAcceso = crypto.randomBytes(32).toString('hex');
    
    // Actualizar el token del cliente
    cliente.tokenAcceso = tokenAcceso;
    cliente.tokenActivo = cliente.estado === 'activo';
    
    await cliente.save();
    
    return {
      token: tokenAcceso,
      activo: cliente.tokenActivo
    };
  } catch (error) {
    throw new Error(`Error al generar token: ${error.message}`);
  }
};

// Verificar si un token es válido
const verificarToken = async (token) => {
  try {
    // Buscar cliente con este token
    const cliente = await Cliente.findOne({ tokenAcceso: token });
    
    if (!cliente) {
      return {
        valido: false,
        mensaje: 'Token no encontrado'
      };
    }
    
    // Verificar si el token está activo y el cliente no está suspendido
    const tokenValido = cliente.tokenActivo && cliente.estado === 'activo';
    
    return {
      valido: tokenValido,
      clienteId: cliente._id,
      programa: cliente.programaAdquirido,
      mensaje: tokenValido ? 'Token válido' : 'Token inactivo o cliente suspendido'
    };
  } catch (error) {
    throw new Error(`Error al verificar token: ${error.message}`);
  }
};

// Desactivar token de un cliente
const desactivarToken = async (idCliente) => {
  try {
    const resultado = await Cliente.findByIdAndUpdate(
      idCliente,
      { tokenActivo: false },
      { new: true }
    );
    
    if (!resultado) {
      throw new Error(`Cliente con ID ${idCliente} no encontrado`);
    }
    
    return {
      mensaje: 'Token desactivado correctamente',
      clienteId: idCliente
    };
  } catch (error) {
    throw new Error(`Error al desactivar token: ${error.message}`);
  }
};

// Activar token de un cliente
const activarToken = async (idCliente) => {
  try {
    const cliente = await Cliente.findById(idCliente);
    
    if (!cliente) {
      throw new Error(`Cliente con ID ${idCliente} no encontrado`);
    }
    
    // Solo activar si el cliente está activo
    if (cliente.estado !== 'activo') {
      return {
        activado: false,
        mensaje: 'No se puede activar el token porque el cliente no está activo'
      };
    }
    
    cliente.tokenActivo = true;
    await cliente.save();
    
    return {
      activado: true,
      mensaje: 'Token activado correctamente',
      clienteId: idCliente
    };
  } catch (error) {
    throw new Error(`Error al activar token: ${error.message}`);
  }
};

module.exports = {
  generarToken,
  verificarToken,
  desactivarToken,
  activarToken
};