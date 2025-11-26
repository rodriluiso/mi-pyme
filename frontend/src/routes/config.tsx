import type { ReactNode } from "react";
import DashboardPage from "@/pages/DashboardPage";
import ClientesPage from "@/pages/clientes/ClientesPage";
import ProveedoresPage from "@/pages/proveedores/ProveedoresPage";
import ProductosPage from "@/pages/productos/ProductosPage";
import VentasPage from "@/pages/ventas/VentasPage";
import ComprasPage from "@/pages/compras/ComprasPage";
import FinanzasPage from "@/pages/finanzas/FinanzasPage";
import RecursosHumanosPage from "@/pages/recursos-humanos/RecursosHumanosPage";
import EstadisticasPage from "@/pages/estadisticas/EstadisticasPage";
import ReportesPage from "@/pages/reportes/ReportesPage";
import RentabilidadClientesPage from "@/pages/analisis/RentabilidadClientesPage";
import ConciliacionBancariaPage from "@/pages/bancos/ConciliacionBancariaPage";
import FacturacionElectronicaPage from "@/pages/afip/FacturacionElectronicaPage";
import UsuariosPage from "@/pages/usuarios/UsuariosPage";
import CobranzasPage from "@/pages/ventas/CobranzasPage";
import BalanceGeneralPage from "@/pages/contabilidad/BalanceGeneralPage";
import EstadoResultadosPage from "@/pages/contabilidad/EstadoResultadosPage";
import ConfiguracionEmpresaPage from "@/pages/configuracion/ConfiguracionEmpresaPage";

export type SeccionPrincipal = {
  path: string;
  etiqueta: string;
  element: ReactNode;
  modulo?: string; // Módulo requerido para acceder (opcional para dashboard)
};

export const seccionesPrincipales: SeccionPrincipal[] = [
  {
    path: "",
    etiqueta: "Tablero",
    element: <DashboardPage />,
    modulo: "dashboard"
  },
  {
    path: "clientes",
    etiqueta: "Clientes",
    element: <ClientesPage />,
    modulo: "clientes"
  },
  {
    path: "proveedores",
    etiqueta: "Proveedores",
    element: <ProveedoresPage />,
    modulo: "proveedores"
  },
  {
    path: "productos",
    etiqueta: "Productos",
    element: <ProductosPage />,
    modulo: "productos"
  },
  {
    path: "ventas",
    etiqueta: "Ventas",
    element: <VentasPage />,
    modulo: "ventas"
  },
  {
    path: "ventas/cobranzas",
    etiqueta: "Cobranzas",
    element: <CobranzasPage />,
    modulo: "ventas"
  },
  {
    path: "compras",
    etiqueta: "Compras",
    element: <ComprasPage />,
    modulo: "compras"
  },
  {
    path: "finanzas",
    etiqueta: "Finanzas",
    element: <FinanzasPage />,
    modulo: "finanzas"
  },
  {
    path: "recursos-humanos",
    etiqueta: "Recursos humanos",
    element: <RecursosHumanosPage />,
    modulo: "recursos_humanos"
  },
  {
    path: "estadisticas",
    etiqueta: "Estadísticas",
    element: <EstadisticasPage />,
    modulo: "reportes"
  },
  {
    path: "reportes",
    etiqueta: "Reportes",
    element: <ReportesPage />,
    modulo: "reportes"
  },
  {
    path: "analisis/rentabilidad-clientes",
    etiqueta: "Rentabilidad Clientes",
    element: <RentabilidadClientesPage />,
    modulo: "reportes"
  },
  {
    path: "bancos/conciliacion",
    etiqueta: "Conciliación Bancaria",
    element: <ConciliacionBancariaPage />,
    modulo: "bancos"
  },
  {
    path: "afip/facturacion-electronica",
    etiqueta: "Facturación Electrónica",
    element: <FacturacionElectronicaPage />,
    modulo: "afip"
  },
  {
    path: "usuarios",
    etiqueta: "Gestión de Usuarios",
    element: <UsuariosPage />,
    modulo: "usuarios"
  },
  {
    path: "contabilidad/balance-general",
    etiqueta: "Balance General",
    element: <BalanceGeneralPage />,
    modulo: "reportes"
  },
  {
    path: "contabilidad/estado-resultados",
    etiqueta: "Estado de Resultados",
    element: <EstadoResultadosPage />,
    modulo: "reportes"
  },
  {
    path: "configuracion",
    etiqueta: "Configuración de Empresa",
    element: <ConfiguracionEmpresaPage />,
    modulo: "configuracion"
  }
];
