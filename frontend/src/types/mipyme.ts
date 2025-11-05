export interface SucursalCliente {
  id: number;
  cliente: number;
  nombre_sucursal: string;
  codigo_sucursal: string;
  contacto_responsable: string;
  telefono: string;
  correo: string;
  direccion: string;
  localidad: string;
  codigo_postal: string;
  horario_entrega: string;
  observaciones: string;
  activo: boolean;
  nombre_completo: string;
  direccion_completa: string;
  fecha_creacion: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  identificacion: string;
  direccion: string;
  localidad: string;
  telefono: string;
  correo: string;
  saldo?: string;
  total_sucursales?: number;
  sucursales?: SucursalCliente[];
}

export interface PerfilClienteResponse {
  cliente: Cliente;
  historial_ventas: Array<{ id: number; fecha: string; total: string }>;
  historial_compras: Array<{ id: number; fecha: string; total: string }>;
  pagos: Array<{ id: number; fecha: string; monto: string; medio: string }>;
  saldo: string;
  total_ventas: string;
  total_compras: string;
  total_pagos: string;
}

export interface Proveedor {
  id: number;
  nombre: string;
  identificacion: string;
  contacto: string;
  telefono: string;
  correo: string;
  direccion: string;
  notas: string;
  activo: boolean;
}

export interface Producto {
  id: number;
  nombre: string;
  sku: string;
  descripcion: string;
  precio: string;
  stock: string;
  stock_kg: string;
  stock_minimo: string;
  stock_minimo_kg: string;
  activo: boolean;
}

export interface MateriaPrima {
  id: number;
  nombre: string;
  sku: string;
  descripcion: string;
  unidad_medida: string;
  stock: string;
  stock_minimo: string;
  precio_promedio: string;
  activo: boolean;
}

export interface ProveedorMateriaPrima {
  proveedor_id: number;
  proveedor_nombre: string;
  cantidad_comprada: number;
  numero_compras: number;
  precio_promedio: number;
}

export interface StockDetallado {
  id: number;
  nombre: string;
  sku: string;
  unidad_medida: string;
  stock_actual: number;
  precio_promedio_actual: number;
  proveedores: ProveedorMateriaPrima[];
}

export interface LineaVenta {
  id: number;
  producto: number | null;
  producto_nombre: string | null;
  descripcion: string;
  cantidad: string;
  cantidad_kg: string;
  precio_unitario: string;
  subtotal: string;
}

export interface Venta {
  id: number;
  fecha: string;
  numero: string;
  cliente: number;
  cliente_nombre: string;
  incluye_iva: boolean;
  subtotal: string;
  iva_monto: string;
  total: string;
  lineas: LineaVenta[];
}

export interface CompraLinea {
  id: number;
  materia_prima: number | null;
  materia_prima_nombre: string | null;
  descripcion: string;
  cantidad: string | null;
  precio_unitario: string | null;
  total_linea: string | null;
  subtotal: string;
}

export interface Compra {
  id: number;
  fecha: string;
  numero: string;
  proveedor: number;
  proveedor_nombre: string;
  categoria: number | null;
  categoria_nombre: string | null;
  total: string;
  notas: string;
  lineas: CompraLinea[];
}

export interface PagoCliente {
  id: number;
  fecha: string;
  cliente: number;
  cliente_nombre: string;
  venta: number | null;
  venta_numero: string | null;
  monto: string;
  medio: string;
  medio_display: string;
  observacion: string;
}

export interface MovimientoFinanciero {
  id: number;
  fecha: string;
  tipo: string;
  estado?: string;
  estado_display?: string;
  origen: string;
  origen_display: string;
  monto: string;
  monto_pagado?: string;
  monto_pendiente?: string;
  descripcion: string;
  compra: number | null;
  compra_id: number | null;
  venta: number | null;
  venta_id: number | null;
  proveedor?: number | null;
  proveedor_nombre?: string | null;
  referencia_extra: string;
  medio_pago?: string | null;
  medio_pago_display?: string | null;
}

export interface Empleado {
  id: number;
  nombre: string;
  apellidos: string;
  nombre_completo: string;
  identificacion: string;
  cuil: string;
  telefono: string;
  fecha_ingreso: string;
  direccion: string;
  puesto: string;
  activo: boolean;
}

export interface PagoEmpleado {
  id: number;
  fecha: string;
  empleado: number;
  empleado_nombre: string;
  monto: string;
  medio_pago: string;
  medio_pago_display: string;
  concepto: string;
  generar_recibo: boolean;
}

export interface ResumenPendiente {
  total_ventas: string;
  total_ventas_sin_iva: string;
  iva_ventas: string;
  total_pagos: string;
  pendiente_cobro: string;
  total_compras: string;
  total_gastos: string;
  balance: {
    total_ingresos: string;
    total_egresos: string;
    balance_neto: string;
    margen_porcentaje: number;
    es_positivo: boolean;
    estado: 'positivo' | 'negativo' | 'neutral';
  };
}

export interface ResumenCompraPorProveedor {
  proveedor_id: number;
  proveedor: string;
  total: number;
  compras: number;
}

export interface ResumenCompraPorCategoria {
  categoria_id: number | null;
  categoria: string;
  total: number;
  compras: number;
}

export interface AlertaDashboard {
  tipo: string;
  categoria: string;
  id: number;
  titulo: string;
  descripcion: string;
  urgencia: 'alta' | 'media' | 'baja';
  fecha: string | null;
  datos: {
    [key: string]: string;
  };
}

// Tipos para Reportes Avanzados
export interface ReporteRentabilidadProducto {
  producto_id: number;
  producto_nombre: string;
  producto_sku: string;
  total_vendido: number;
  cantidad_vendida: number;
  ventas_count: number;
  precio_promedio: number;
  costo_estimado: number;
  margen_bruto: number;
  margen_porcentaje: number;
}

export interface ResumenRentabilidadProductos {
  total_productos: number;
  total_vendido: number;
  margen_promedio: number;
}

export interface ReporteRentabilidadProductosResponse {
  periodo: {
    fecha_desde: string | null;
    fecha_hasta: string | null;
  };
  productos: ReporteRentabilidadProducto[];
  resumen: ResumenRentabilidadProductos;
}

export interface ReporteRentabilidadCliente {
  cliente_id: number;
  cliente_nombre: string;
  cliente_identificacion: string;
  total_vendido: number;
  total_pagado: number;
  deuda_pendiente: number;
  ventas_count: number;
  venta_promedio: number;
  primera_venta: string | null;
  ultima_venta: string | null;
  dias_ultima_venta: number;
  porcentaje_pago: number;
}

export interface ResumenRentabilidadClientes {
  total_clientes: number;
  total_vendido: number;
  total_cobrado: number;
  deuda_total: number;
}

export interface ReporteRentabilidadClientesResponse {
  periodo: {
    fecha_desde: string | null;
    fecha_hasta: string | null;
  };
  clientes: ReporteRentabilidadCliente[];
  resumen: ResumenRentabilidadClientes;
}

export interface VentaMensual {
  año: number;
  mes: number;
  mes_nombre: string;
  total_ventas: number;
  cantidad_ventas: number;
  venta_promedio: number;
}

export interface ComparativaAnual {
  año_actual: {
    año: number;
    total_ventas: number;
    cantidad_ventas: number;
  };
  año_anterior: {
    año: number;
    total_ventas: number;
    cantidad_ventas: number;
  };
  crecimiento_porcentual: number;
}

export interface TopProducto {
  producto_nombre: string;
  producto_sku: string;
  total_vendido: number;
  cantidad_vendida: number;
}

export interface TendenciasVentasResponse {
  periodo_analisis: {
    fecha_desde: string;
    fecha_hasta: string;
  };
  ventas_mensuales: VentaMensual[];
  comparativa_anual: ComparativaAnual;
  top_productos: TopProducto[];
}

export interface AjusteStockMateriaPrima {
  id: number;
  fecha: string;
  materia_prima: number;
  materia_prima_nombre: string;
  tipo_ajuste: string;
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  motivo: string;
  usuario: string;
}

export interface AjusteStockRequest {
  tipo_ajuste: 'ENTRADA' | 'SALIDA' | 'CORRECCION' | 'MERMA' | 'DEVOLUCION';
  cantidad: number;
  motivo: string;
  usuario?: string;
  proveedor_id?: number;
}

export interface StockPorProveedor {
  id: number;
  materia_prima: number;
  materia_prima_nombre: string;
  proveedor: number;
  proveedor_nombre: string;
  cantidad_stock: string;
  precio_promedio: string;
  ultima_compra: string;
  total_comprado: string;
  unidad_medida: string;
}

export interface StockResumenPorProveedor {
  materia_prima_id: number;
  materia_prima_nombre: string;
  sku: string;
  unidad_medida: string;
  stock_total: number;
  proveedores: StockPorProveedor[];
}

// Tipos para Resumen por Medio de Pago
export interface ResumenPorMedio {
  medio: string;
  medio_display: string;
  ingresos: string;
  egresos: string;
  neto: string;
  cantidad_ingresos: number;
  cantidad_egresos: number;
  es_positivo: boolean;
}

export interface ResumenPorMedioResponse {
  por_medio: ResumenPorMedio[];
  totales: {
    total_ingresos: string;
    total_egresos: string;
    total_neto: string;
    es_positivo: boolean;
  };
  periodo: {
    fecha_desde: string | null;
    fecha_hasta: string | null;
  };
}

// Tipos para Comparativas Período a Período
export interface MetricasPeriodo {
  ventas: {
    total: string;
    cantidad: number;
    ticket_promedio: string;
  };
  compras: {
    total: string;
    cantidad: number;
  };
  flujo_efectivo: {
    ingresos: string;
    egresos: string;
    balance_neto: string;
  };
  rentabilidad: {
    margen_bruto: string;
    margen_porcentaje: number;
  };
}

export interface PeriodoComparativo {
  fecha_inicio: string;
  fecha_fin: string;
  etiqueta: string;
  metricas: MetricasPeriodo;
}

export interface VariacionesPeriodo {
  ventas_total: number;
  ventas_cantidad: number;
  ticket_promedio: number;
  compras_total: number;
  ingresos: number;
  egresos: number;
  balance_neto: number;
  margen_bruto: number;
  margen_porcentaje: number;
}

export interface ComparativasPeriodoResponse {
  periodo_actual: PeriodoComparativo;
  periodo_anterior: PeriodoComparativo;
  variaciones: VariacionesPeriodo;
  resumen: {
    tipo_comparacion: 'mes_anterior' | 'año_anterior' | 'trimestre_anterior';
    dias_periodo: number;
    tendencia_general: 'positiva' | 'negativa';
  };
}

// Tipos de autenticación
export interface Usuario {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  nivel_acceso: 'ADMIN_TOTAL' | 'ADMIN_NIVEL_2' | 'ADMIN_NIVEL_1';
  nivel_acceso_display: string;
  telefono?: string;
  cargo?: string;
  fecha_ingreso?: string;
  activo: boolean;
  ultima_actividad?: string;
  modulos_permitidos: string[];
  puede_gestionar_usuarios: boolean;
  fecha_creacion: string;
}

// Tipos para Cuentas por Pagar
export interface ResumenProveedorPago {
  proveedor_id: number;
  proveedor_nombre: string;
  total_pendiente: number;
  cantidad_movimientos: number;
  movimientos_vencidos: number;
  total_vencido: number;
}

export interface ResumenCuentasPagar {
  resumen_general: {
    total_pendiente_pagar: string;
    cantidad_movimientos: number;
    cantidad_proveedores: number;
    proximos_vencer_7_dias: number;
  };
  por_proveedor: ResumenProveedorPago[];
  movimientos_detalle: MovimientoFinanciero[];
  proximos_vencimientos: MovimientoFinanciero[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  mensaje: string;
  usuario: Usuario;
}

export interface AuthContextType {
  user: Usuario | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Usuario>) => Promise<void>;
  canAccessModule: (modulo: string) => boolean;
}
