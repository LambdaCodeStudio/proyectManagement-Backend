const Pago = require('../models/pagosSchema');
const Cliente = require('../models/clienteSchema');

// Registrar un nuevo pago
const registrarPago = async (datosPago) => {
  try {
    // Crear el nuevo registro de pago
    const nuevoPago = new Pago(datosPago);
    const pagoGuardado = await nuevoPago.save();
    
    // Actualizar información del cliente
    const cliente = await Cliente.findById(datosPago.idCliente);
    if (!cliente) {
      throw new Error(`Cliente con ID ${datosPago.idCliente} no encontrado`);
    }
    
    // Actualizar fecha del último pago
    cliente.fechaUltimoPago = new Date();
    
    // Calcular próxima fecha de pago según el plan
    const fechaProximoPago = new Date(datosPago.periodoFacturado.fin);
    cliente.fechaProximoPago = fechaProximoPago;
    
    // Resetear flags de notificaciones
    cliente.recordatorioEnviado = false;
    cliente.avisoSuspensionEnviado = false;
    
    // Agregar pago al historial del cliente
    cliente.historialPagos.push(pagoGuardado._id);
    
    // Guardar cambios en el cliente
    await cliente.save();
    
    return pagoGuardado;
  } catch (error) {
    throw new Error(`Error al registrar pago: ${error.message}`);
  }
};

// Obtener historial de pagos de un cliente
const obtenerHistorialPagos = async (idCliente) => {
  try {
    return await Pago.find({ idCliente })
                     .sort({ fechaPago: -1 });
  } catch (error) {
    throw new Error(`Error al obtener historial de pagos: ${error.message}`);
  }
};

// Verificar pagos vencidos y clientes en periodo de gracia
const verificarEstadoPagos = async () => {
  try {
    const hoy = new Date();
    
    // Encontrar clientes con pagos próximos (7 días antes)
    const fechaRecordatorio = new Date();
    fechaRecordatorio.setDate(hoy.getDate() + 7);
    
    const clientesProximoPago = await Cliente.find({
      estado: 'activo',
      fechaProximoPago: { $lte: fechaRecordatorio },
      recordatorioEnviado: false
    });
    
    // Encontrar clientes en periodo de gracia
    const clientesEnGracia = await Cliente.find({
      estado: 'activo',
      fechaProximoPago: { $lt: hoy }
    }).lean();
    
    // Encontrar clientes con pagos vencidos (fuera del periodo de gracia)
    const clientesVencidos = clientesEnGracia.filter(cliente => {
      const fechaLimite = new Date(cliente.fechaProximoPago);
      fechaLimite.setDate(fechaLimite.getDate() + cliente.diasGracia);
      return hoy > fechaLimite;
    });
    
    // Actualizar estado de clientes vencidos
    for (const cliente of clientesVencidos) {
      await Cliente.findByIdAndUpdate(
        cliente._id,
        { 
          estado: 'suspendido',
          tokenActivo: false
        }
      );
    }
    
    return {
      clientesProximoPago,
      clientesEnGracia: clientesEnGracia.filter(c => !clientesVencidos.includes(c)),
      clientesVencidos
    };
  } catch (error) {
    throw new Error(`Error al verificar estado de pagos: ${error.message}`);
  }
};

// Generar reporte de pagos por periodo
const generarReportePagos = async (fechaInicio, fechaFin) => {
  try {
    const pagos = await Pago.find({
      fechaPago: {
        $gte: new Date(fechaInicio),
        $lte: new Date(fechaFin)
      }
    }).populate('idCliente', 'nombre email programaAdquirido');
    
    // Calcular totales
    const totalRecaudado = pagos.reduce((total, pago) => total + pago.monto, 0);
    const pagosPorPrograma = pagos.reduce((acc, pago) => {
      const programa = pago.idCliente?.programaAdquirido || 'desconocido';
      acc[programa] = (acc[programa] || 0) + pago.monto;
      return acc;
    }, {});
    
    return {
      pagos,
      totalRecaudado,
      pagosPorPrograma,
      periodo: {
        inicio: fechaInicio,
        fin: fechaFin
      }
    };
  } catch (error) {
    throw new Error(`Error al generar reporte de pagos: ${error.message}`);
  }
};

// Marcar factura como emitida
const marcarFacturado = async (idPago, datosFactura) => {
  try {
    return await Pago.findByIdAndUpdate(
      idPago,
      {
        facturado: true,
        numeroFactura: datosFactura.numeroFactura,
        fechaFactura: datosFactura.fechaFactura || new Date()
      },
      { new: true }
    );
  } catch (error) {
    throw new Error(`Error al marcar pago como facturado: ${error.message}`);
  }
};

module.exports = {
  registrarPago,
  obtenerHistorialPagos,
  verificarEstadoPagos,
  generarReportePagos,
  marcarFacturado
};