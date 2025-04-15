const pagosLogic = require('../logic/pagosLogic');

// Registrar un nuevo pago
const registrarPago = async (req, res) => {
  try {
    const datosPago = req.body;
    
    // Añadir usuario que registra el pago
    datosPago.registradoPor = req.user.id;
    
    const pago = await pagosLogic.registrarPago(datosPago);
    return res.status(201).json(pago);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener historial de pagos de un cliente
const obtenerHistorialPagos = async (req, res) => {
  try {
    const { idCliente } = req.params;
    const historial = await pagosLogic.obtenerHistorialPagos(idCliente);
    return res.status(200).json(historial);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Verificar estado de pagos (para uso administrativo)
const verificarEstadoPagos = async (req, res) => {
  try {
    const resultado = await pagosLogic.verificarEstadoPagos();
    return res.status(200).json(resultado);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Generar reporte de pagos por periodo
const generarReportePagos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ 
        message: 'Se requieren los parámetros fechaInicio y fechaFin'
      });
    }
    
    const reporte = await pagosLogic.generarReportePagos(fechaInicio, fechaFin);
    return res.status(200).json(reporte);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Marcar pago como facturado
const marcarFacturado = async (req, res) => {
  try {
    const { id } = req.params;
    const datosFactura = req.body;
    
    const pago = await pagosLogic.marcarFacturado(id, datosFactura);
    
    if (!pago) {
      return res.status(404).json({ message: 'Pago no encontrado' });
    }
    
    return res.status(200).json(pago);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registrarPago,
  obtenerHistorialPagos,
  verificarEstadoPagos,
  generarReportePagos,
  marcarFacturado
};