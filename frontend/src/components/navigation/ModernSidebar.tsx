import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { NavigationIcons } from "@/components/icons/NavigationIcons";

// Definición de las secciones de navegación organizadas por categorías
const navigationSections = [
  {
    title: "Operaciones",
    items: [
      {
        to: "/",
        label: "Tablero",
        icon: NavigationIcons.Dashboard,
        badge: null,
      },
      {
        to: "/ventas",
        label: "Ventas",
        icon: NavigationIcons.Ventas,
        badge: null,
      },
      {
        to: "/productos",
        label: "Productos",
        icon: NavigationIcons.Productos,
        badge: null,
      },
      {
        to: "/compras",
        label: "Compras",
        icon: NavigationIcons.Compras,
        badge: null,
      },
    ],
  },
  {
    title: "Gestión",
    items: [
      {
        to: "/clientes",
        label: "Clientes",
        icon: NavigationIcons.Clientes,
        badge: null,
      },
      {
        to: "/proveedores",
        label: "Proveedores",
        icon: NavigationIcons.Proveedores,
        badge: null,
      },
      {
        to: "/recursos-humanos",
        label: "Recursos Humanos",
        icon: NavigationIcons.RecursosHumanos,
        badge: null,
      },
    ],
  },
  {
    title: "Análisis",
    items: [
      {
        to: "/finanzas",
        label: "Finanzas",
        icon: NavigationIcons.Finanzas,
        badge: null,
      },
      {
        to: "/reportes",
        label: "Reportes",
        icon: NavigationIcons.Reportes,
        badge: null,
      },
      {
        to: "/analisis/rentabilidad-clientes",
        label: "Rentabilidad Clientes",
        icon: NavigationIcons.RentabilidadClientes,
        badge: null,
      },
      {
        to: "/bancos/conciliacion",
        label: "Conciliación Bancaria",
        icon: NavigationIcons.ConciliacionBancaria,
        badge: null,
      },
      {
        to: "/afip/facturacion-electronica",
        label: "Facturación Electrónica",
        icon: NavigationIcons.FacturacionElectronica,
        badge: null,
      },
    ],
  },
  {
    title: "Administración",
    items: [
      {
        to: "/configuracion",
        label: "Configuración Empresa",
        icon: NavigationIcons.Settings,
        badge: null,
      },
      {
        to: "/usuarios",
        label: "Gestión de Usuarios",
        icon: NavigationIcons.Usuarios,
        badge: null,
      },
    ],
  },
];

interface ModernSidebarProps {
  isMobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
}

const ModernSidebar = ({ isMobileMenuOpen, onMobileMenuClose }: ModernSidebarProps) => {
  const { isSidebarCollapsed, toggleSidebar, notificationCount } = useAppContext();
  const [expandedSections, setExpandedSections] = useState<string[]>(["Operaciones", "Gestión", "Análisis"]);

  const toggleSection = (sectionTitle: string) => {
    if (isSidebarCollapsed) return; // No expandir secciones si está colapsado

    setExpandedSections(prev =>
      prev.includes(sectionTitle)
        ? prev.filter(title => title !== sectionTitle)
        : [...prev, sectionTitle]
    );
  };

  const renderNavItem = (item: typeof navigationSections[0]['items'][0]) => {
    const IconComponent = item.icon;

    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={onMobileMenuClose}
        className={({ isActive }) =>
          `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
            isActive
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          } ${isSidebarCollapsed ? "justify-center" : ""}`
        }
        title={isSidebarCollapsed ? item.label : undefined}
      >
        <IconComponent className="flex-shrink-0 w-5 h-5" />
        {!isSidebarCollapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {item.badge}
              </span>
            )}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-25 sm:hidden"
          onClick={onMobileMenuClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col bg-white shadow-xl transition-all duration-300 ease-in-out
          dark:bg-slate-900 dark:border-slate-700
          lg:relative lg:translate-x-0 lg:shadow-lg
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${isSidebarCollapsed ? "w-16" : "w-64"}
        `}
      >
        {/* Header */}
        <div className={`flex items-center justify-center border-b border-slate-200 py-8 px-4 dark:border-slate-700`}>
          {!isSidebarCollapsed && (
            <img
              src="/logo.png"
              alt="Lácteos El Roble"
              className="h-32 w-full object-contain"
            />
          )}

          {isSidebarCollapsed && (
            <img
              src="/logo.png"
              alt="Lácteos El Roble"
              className="h-12 w-12 object-contain"
            />
          )}

          {/* Mobile close button */}
          <button
            onClick={onMobileMenuClose}
            className="sm:hidden p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          >
            <NavigationIcons.Close className="w-5 h-5" />
          </button>

          {/* Desktop collapse button */}
          <button
            onClick={toggleSidebar}
            className={`hidden sm:flex p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 ${
              isSidebarCollapsed ? "absolute -right-3 top-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-md" : ""
            }`}
            title={isSidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            {isSidebarCollapsed ? (
              <NavigationIcons.Expand className="w-4 h-4" />
            ) : (
              <NavigationIcons.Collapse className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {navigationSections.map((section) => {
              const isExpanded = expandedSections.includes(section.title);

              return (
                <div key={section.title}>
                  {!isSidebarCollapsed && (
                    <button
                      onClick={() => toggleSection(section.title)}
                      className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      <span>{section.title}</span>
                      <NavigationIcons.ChevronDown
                        className={`w-3 h-3 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}

                  <div className={`space-y-1 ${!isSidebarCollapsed && !isExpanded ? 'hidden' : ''}`}>
                    {section.items.map(renderNavItem)}
                  </div>

                  {isSidebarCollapsed && section !== navigationSections[navigationSections.length - 1] && (
                    <div className="my-4 border-t border-slate-200 dark:border-slate-700"></div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer con notificaciones */}
        {!isSidebarCollapsed && (
          <div className="border-t border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
              <div className="relative">
                <NavigationIcons.Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white">Notificaciones</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {notificationCount === 0 ? 'Sin alertas' : `${notificationCount} nueva${notificationCount > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {isSidebarCollapsed && notificationCount > 0 && (
          <div className="p-2 flex justify-center">
            <div className="relative">
              <NavigationIcons.Bell className="w-6 h-6 text-slate-600 dark:text-slate-300" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default ModernSidebar;