import { Link } from "react-router-dom";

const NotFoundPage = () => {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <span className="text-5xl font-bold text-blue-600">404</span>
      <h2 className="text-2xl font-semibold text-slate-900">Pagina no encontrada</h2>
      <p className="max-w-md text-sm text-slate-500">
        Lo sentimos, la pagina que intentas abrir no existe o fue movida. Volve al tablero para seguir
        gestionando MiPyME.
      </p>
      <Link
        to="/"
        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
      >
        Ir al inicio
      </Link>
    </section>
  );
};

export default NotFoundPage;
