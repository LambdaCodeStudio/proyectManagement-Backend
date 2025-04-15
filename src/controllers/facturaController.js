const facturaLogic = require('../logic/facturaLogic');

// Obtener todas las facturas
const getAllFacturas = async (req, res) => {
  try {
    const facturas = await facturaLogic.getAllFacturas();
    return res.status(200).json(facturas);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener facturas por estado
const getFacturasByEstado = async (req, res) => {
  try {
    const { estado } = req.params;
    const facturas = await facturaLogic.getFacturasByEstado(estado);
    return res.status(200).json(facturas);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener facturas de un cliente específico
const getFacturasByClienteId = async (req, res) => {
  try {
    const { idCliente } = req.params;
    const facturas = await facturaLogic.getFacturasByClienteId(idCliente);
    return res.status(200).json(facturas);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener facturas de un proyecto específico
const getFacturasByProyectoId = async (req, res) => {
  try {
    const { idProyecto } = req.params;
    const facturas = await facturaLogic.getFacturasByProyectoId(idProyecto);
    return res.status(200).json(facturas);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener una factura por su ID
const getFacturaById = async (req, res) => {
  try {
    const { id } = req.params;
    const factura = await facturaLogic.getFacturaById(id);
    
    if (!factura) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }
    
    return res.status(200).json(factura);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Crear una nueva factura
const createFactura = async (req, res) => {
  try {
    const facturaData = req.body;
    
    const newFactura = await facturaLogic.createFactura(facturaData);
    return res.status(201).json(newFactura);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Actualizar una factura por su ID
const updateFacturaById = async (req, res) => {
  try {
    const { id } = req.params;
    const facturaData = req.body;
    
    const updatedFactura = await facturaLogic.updateFacturaById(id, facturaData);
    
    if (!updatedFactura) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }
    
    return res.status(200).json(updatedFactura);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Eliminar una factura por su ID
const deleteFacturaById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedFactura = await facturaLogic.deleteFacturaById(id);
    
    if (!deletedFactura) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }
    
    return res.status(200).json({ message: 'Factura eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Actualizar estado de una factura
const updateFacturaEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const updatedFactura = await facturaLogic.updateFacturaEstado(id, estado);
    
    if (!updatedFactura) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }
    
    return res.status(200).json(updatedFactura);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Obtener facturas vencidas
const getFacturasVencidas = async (req, res) => {
  try {
    const facturas = await facturaLogic.getFacturasVencidas();
    return res.status(200).json(facturas);
  } catch (error) {
    return res.status(500).json({ message: error.message });
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