import { createBrowserRouter, createHashRouter } from "react-router-dom";
import RootLayout from "@/layouts/RootLayout";
import NotFoundPage from "@/pages/NotFoundPage";
import ClientePerfilPage from "@/pages/clientes/ClientePerfilPage";
import LoginPage from "@/pages/auth/LoginPage";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { seccionesPrincipales } from "@/routes/config";

const routes = [
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    errorElement: <NotFoundPage />,
    children: [
      ...seccionesPrincipales.map((seccion) =>
        seccion.path === ""
          ? { index: true, element: seccion.element }
          : { path: seccion.path, element: seccion.element }
      ),
      {
        path: "clientes/:clienteId",
        element: <ClientePerfilPage />
      }
    ]
  },
  {
    path: "*",
    element: <NotFoundPage />
  }
];

// Usar HashRouter en contextos file:// para evitar 404 al cargar index.html
const useHash = typeof window !== 'undefined' && window.location.protocol === 'file:';
if (typeof window !== 'undefined') {
  // Ayuda de diagnóstico para confirmar el modo en consola de DevTools del EXE
  // Se eliminará automáticamente por minificación en build si no se usa
  // eslint-disable-next-line no-console
  console.log(`[Router] modo=${useHash ? 'hash' : 'browser'} protocol=${window.location.protocol}`);
}

export const router = useHash ? createHashRouter(routes) : createBrowserRouter(routes);
