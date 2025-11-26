import { useState, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { seccionesPrincipales } from "@/routes/config";
import { useAuth } from "@/contexts/AuthContext";

const SideNav = () => {
  const { user } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Filtrar secciones según permisos del usuario
  const navLinks = useMemo(() => {
    console.log('[TopNav] User:', user);
    console.log('[TopNav] User modulos_permitidos:', user?.modulos_permitidos);

    if (!user) return [];

    const filtered = seccionesPrincipales
      .filter((seccion) => {
        // Si no tiene módulo definido, permitir acceso
        if (!seccion.modulo) return true;

        // Verificar si el usuario tiene acceso al módulo
        const hasAccess = user.modulos_permitidos?.includes(seccion.modulo) ?? false;
        console.log(`[TopNav] Seccion ${seccion.etiqueta} (modulo: ${seccion.modulo}): ${hasAccess}`);
        return hasAccess;
      })
      .map((seccion) => ({
        to: seccion.path === "" ? "/" : `/${seccion.path}`,
        label: seccion.etiqueta
      }));

    console.log('[TopNav] Filtered navLinks:', filtered);
    return filtered;
  }, [user]);

  const toggleMenu = () => {
    setMenuAbierto(!menuAbierto);
  };

  const cerrarMenu = () => {
    setMenuAbierto(false);
  };

  return (
    <>
      <header className="border-b border-slate-200 bg-white/90 px-4 py-3 shadow-sm sm:hidden">
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold tracking-tight text-blue-600">MiPyME</div>
          <button
            onClick={toggleMenu}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {menuAbierto ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
        {menuAbierto && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black bg-opacity-25"
              onClick={cerrarMenu}
            />
            <nav className="absolute left-0 right-0 top-full z-50 border-t border-slate-200 bg-white shadow-lg">
              <ul className="flex flex-col text-sm font-medium text-slate-600">
                {navLinks.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      onClick={cerrarMenu}
                      className={({ isActive }) =>
                        `block px-4 py-3 transition ${
                          isActive
                            ? "bg-blue-600 text-white"
                            : "hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        )}
      </header>

      <aside className="hidden h-full w-[240px] border-r border-slate-200 bg-white/90 px-4 py-6 text-sm shadow-sm sm:flex">
        <div className="flex h-full w-full flex-col gap-6">
          <div className="text-2xl font-semibold tracking-tight text-blue-600">MiPyME</div>
          <nav className="flex-1">
            <ul className="flex flex-col gap-1 font-medium text-slate-600">
              {navLinks.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    className={({ isActive }) =>
                      `flex w-full items-center rounded-lg px-3 py-2 transition-colors ${
                        isActive
                          ? "bg-blue-600 text-white shadow"
                          : "hover:bg-slate-100"
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
};

export default SideNav;
