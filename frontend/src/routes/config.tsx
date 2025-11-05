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
};

export const seccionesPrincipales: SeccionPrincipal[] = [
  {
    path: "",
    etiqueta: "Tablero",
    element: <DashboardPage />
  },
  {
    path: "clientes",
    etiqueta: "Clientes",
    element: <ClientesPage />
  },
  {
    path: "proveedores",
    etiqueta: "Proveedores",
    element: <ProveedoresPage />
  },
  {
    path: "productos",
    etiqueta: "Productos",
    element: <ProductosPage />
  },
  {
    path: "ventas",
    etiqueta: "Ventas",
    element: <VentasPage />
  },
  {
    path: "ventas/cobranzas",
    etiqueta: "Cobranzas",
    element: <CobranzasPage />
  },
  {
    path: "compras",
    etiqueta: "Compras",
    element: <ComprasPage />
  },
  {
    path: "finanzas",
    etiqueta: "Finanzas",
    element: <FinanzasPage />
  },
  {
    path: "recursos-humanos",
    etiqueta: "Recursos humanos",
    element: <RecursosHumanosPage />
  },
  {
    path: "estadisticas",
    etiqueta: "Estadísticas",
    element: <EstadisticasPage />
  },
  {
    path: "reportes",
    etiqueta: "Reportes",
    element: <ReportesPage />
  },
  {
    path: "analisis/rentabilidad-clientes",
    etiqueta: "Rentabilidad Clientes",
    element: <RentabilidadClientesPage />
  },
  {
    path: "bancos/conciliacion",
    etiqueta: "Conciliación Bancaria",
    element: <ConciliacionBancariaPage />
  },
  {
    path: "afip/facturacion-electronica",
    etiqueta: "Facturación Electrónica",
    element: <FacturacionElectronicaPage />
  },
  {
    path: "usuarios",
    etiqueta: "Gestión de Usuarios",
    element: <UsuariosPage />
  },
  {
    path: "contabilidad/balance-general",
    etiqueta: "Balance General",
    element: <BalanceGeneralPage />
  },
  {
    path: "contabilidad/estado-resultados",
    etiqueta: "Estado de Resultados",
    element: <EstadoResultadosPage />
  },
  {
    path: "configuracion",
    etiqueta: "Configuración de Empresa",
    element: <ConfiguracionEmpresaPage />
  }
];
