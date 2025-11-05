import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { NavigationIcons } from "@/components/icons/NavigationIcons";

interface ModernHeaderProps {
  onMenuClick: () => void;
  title?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

const ModernHeader = ({ onMenuClick, title, breadcrumbs }: ModernHeaderProps) => {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme, notificationCount, isSidebarCollapsed } = useAppContext();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implementar búsqueda global
    console.log("Búsqueda:", searchQuery);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error durante logout:', error);
    }
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const firstName = user.first_name || user.username;
    const lastName = user.last_name || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  };

  const getUserDisplayName = () => {
    if (!user) return 'Usuario';
    return user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.username;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:hidden"
          aria-label="Abrir menú"
        >
          <NavigationIcons.Menu />
        </button>

        {/* Breadcrumbs / Title */}
        <div className="flex-1 min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <nav className="flex items-center space-x-2 text-sm">
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center">
                  {index > 0 && (
                    <NavigationIcons.ChevronRight className="mx-2 w-4 h-4 text-slate-400" />
                  )}
                  {crumb.href ? (
                    <a
                      href={crumb.href}
                      className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="text-slate-900 font-medium dark:text-white">
                      {crumb.label}
                    </span>
                  )}
                </div>
              ))}
            </nav>
          ) : title ? (
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
              {title}
            </h1>
          ) : null}
        </div>

        {/* Search bar */}
        <div className="hidden sm:flex">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative">
              <NavigationIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className={`
                  w-64 pl-10 pr-4 py-2 text-sm border rounded-lg transition-all duration-200
                  ${isSearchFocused
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : 'border-slate-300 dark:border-slate-600'
                  }
                  bg-white dark:bg-slate-800
                  text-slate-900 dark:text-white
                  placeholder-slate-500 dark:placeholder-slate-400
                  focus:outline-none
                `}
              />
            </div>

            {/* Search suggestions (placeholder for future implementation) */}
            {isSearchFocused && searchQuery.length > 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-2 z-50">
                <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                  Buscar "{searchQuery}" en...
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700">
                  <button className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                    📊 Productos
                  </button>
                  <button className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                    👥 Clientes
                  </button>
                  <button className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                    💰 Ventas
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Notificaciones"
          >
            <NavigationIcons.Bell />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {isDarkMode ? <NavigationIcons.Sun /> : <NavigationIcons.Moon />}
          </button>

          {/* Settings */}
          <button
            onClick={() => navigate('/configuracion')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Configuración"
          >
            <NavigationIcons.Settings />
          </button>

          {/* User menu */}
          <div className="ml-2 flex items-center relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-xs">
                {getUserInitials()}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium text-slate-900 dark:text-white">{getUserDisplayName()}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{user?.nivel_acceso_display}</div>
              </div>
              <NavigationIcons.ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </button>

            {/* User dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">{getUserDisplayName()}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</div>
                </div>
                <button className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
                  👤 Mi Perfil
                </button>
                <button
                  onClick={() => {
                    navigate('/configuracion');
                    setShowUserMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  ⚙️ Configuración
                </button>
                <div className="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-red-600 dark:text-red-400"
                >
                  🚪 Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 sm:hidden">
        <form onSubmit={handleSearch} className="relative">
          <NavigationIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </form>
      </div>
    </header>
  );
};

export default ModernHeader;