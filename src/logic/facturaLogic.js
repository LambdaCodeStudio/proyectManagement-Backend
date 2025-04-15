const Factura = require('../models/facturaSchema');
const Cliente = require('../models/clienteSchema');
const Proyecto = require('../models/proyectoSchema');

// Obtener todas las facturas
const getAllFacturas = async () => {
  try {
    return await Factura.find()
      .populate('idCliente', 'nombre email')
      .populate('idProyecto', 'nombre');
  } catch (error) {
    throw new Error(`Error al obtener todas las facturas: ${error.message}`);
  }
};

// Obtener facturas por estado
const getFacturasByEstado = async (estado) => {
  try {
    return await Factura.find({ estado })
      .populate('idCliente', 'nombre email')
      .populate('idProyecto', 'nombre');
  } catch (error) {
    throw new Error(`Error al obtener facturas por estado: ${error.message}`);
  }
};

// Obtener facturas de un cliente específico
const getFacturasByClienteId = async (idCliente) => {
  try {
    return await Factura.find({ idCliente })
      .populate('idProyecto', 'nombre')
      .sort({ fechaEmision: -1 });
  } catch (error) {
    throw new Error(`Error al obtener facturas del cliente: ${error.message}`);
  }
};

// Obtener facturas de un proyecto específico
const getFacturasByProyectoId = async (idProyecto) => {
  try {
    return await Factura.find({ idProyecto })
      .populate('idCliente', 'nombre email')
      .sort({ fechaEmision: -1 });
  } catch (error) {
    throw new Error(`Error al obtener facturas del proyecto: ${error.message}`);
  }
};

// Obtener una factura por su ID
const getFacturaById = async (id) => {
  try {
    return await Factura.findById(id)
      .populate('idCliente', 'nombre email telefono razonSocial ruc direccion')
      .populate('idProyecto', 'nombre descripcion');
  } catch (error) {
    throw new Error(`Error al obtener la factura por ID: ${error.message}`);
  }
};

// Crear una nueva factura
const createFactura = async (facturaData) => {
  try {
    // Verificar que el cliente existe
    const clienteExists = await Cliente.findById(facturaData.idCliente);
    if (!clienteExists) {
      throw new Error('El cliente especificado no existe');
    }
    
    // Verificar que el proyecto existe (si se especifica)
    if (facturaData.idProyecto) {
      const proyectoExists = await Proyecto.findById(facturaData.idProyecto);
      if (!proyectoExists) {
        throw new Error('El proyecto especificado no existe');
      }
    }
    
    // Generar número de factura si no se proporciona
    if (!facturaData.numeroFactura) {
      facturaData.numeroFactura = await Factura.generarNumeroFactura();
    }
    
    // Calcular subtotal, impuestos y total si no se proporcionan
    if (facturaData.conceptos && facturaData.conceptos.length > 0 && !facturaData.subtotal) {
      let subtotal = 0;
      let impuestos = 0;
      
      facturaData.conceptos.forEach(concepto => {
        const montoConcepto = concepto.cantidad * concepto.precioUnitario;
        subtotal += montoConcepto;
        impuestos += montoConcepto * (concepto.impuesto / 100);
      });
      
      facturaData.subtotal = subtotal;
      facturaData.impuestos = impuestos;
      facturaData.total = subtotal + impuestos;
    }
    
    const newFactura = new Factura(facturaData);
    await newFactura.save();
    
    return newFactura;
  } catch (error) {
    throw new Error(`Error al crear la factura: ${error.message}`);
  }
};

// Actualizar una factura por su ID
const updateFacturaById = async (id, facturaData) => {
  try {
    // Recalcular totales si los conceptos fueron actualizados
    if (facturaData.conceptos && facturaData.conceptos.length > 0) {
      let subtotal = 0;
      let impuestos = 0;
      
      facturaData.conceptos.forEach(concepto => {
        const montoConcepto = concepto.cantidad * concepto.precioUnitario;
        subtotal += montoConcepto;
        impuestos += montoConcepto * (concepto.impuesto / 100);
      });
      
      facturaData.subtotal = subtotal;
      facturaData.impuestos = impuestos;
      facturaData.total = subtotal + impuestos;
    }
    
    return await Factura.findByIdAndUpdate(
      id,
      facturaData,
      { new: true, runValidators: true }
    );
  } catch (error) {
    throw new Error(`Error al actualizar la factura: ${error.message}`);
  }
};

// Eliminar una factura por su ID
const deleteFacturaById = async (id) => {
  try {
    return await Factura.findByIdAndDelete(id);
  } catch (error) {
    throw new Error(`Error al eliminar la factura: ${error.message}`);
  }
};

// Actualizar estado de una factura
const updateFacturaEstado = async (id, estado) => {
  try {
    return await Factura.findByIdAndUpdate(
      id,
      { estado },
      { new: true, runValidators: true }
    );
  } catch (error) {
    throw new Error(`Error al actualizar el estado de la factura: ${error.message}`);
  }
};

// Obtener facturas vencidas
const getFacturasVencidas = async () => {
  try {
    const hoy = new Date();
    return await Factura.find({
      fechaVencimiento: { $lt: hoy },
      estado: 'pendiente'
    })
      .populate('idCliente', 'nombre email')
      .populate('idProyecto', 'nombre');
  } catch (error) {
    throw new Error(`Error al obtener facturas vencidas: ${error.message}`);
  }
};

module.exports = {
  getAllFacturas,
  getFacturasByEstado,
  getFacturasByClienteId,
  getFacturasByProyectoId,
  getFacturaById,
  createFactura,
  updateFacturaById,
  deleteFacturaById,
  updateFacturaEstado,
  getFacturasVencidas
};