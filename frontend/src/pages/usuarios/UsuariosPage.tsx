import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';

// Iconos SVG simples para reemplazar Heroicons
const UserPlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const ShieldCheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5-6v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2z" />
  </svg>
);

const PencilIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const KeyIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

interface Usuario {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  nivel_acceso: 'ADMIN_TOTAL' | 'ADMIN_NIVEL_2' | 'ADMIN_NIVEL_1';
  nivel_acceso_display: string;
  cargo: string;
  telefono: string;
  activo: boolean;
  ultima_actividad: string;
  fecha_creacion: string;
}

interface FormularioUsuario {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  nivel_acceso: 'ADMIN_TOTAL' | 'ADMIN_NIVEL_2' | 'ADMIN_NIVEL_1';
  cargo: string;
  telefono: string;
  password: string;
  password_confirm: string;
  activo: boolean;
}

interface EstadisticasUsuarios {
  total_usuarios: number;
  usuarios_por_nivel: {
    [key: string]: {
      nombre: string;
      cantidad: number;
    };
  };
}

const UsuariosPage = () => {
  const { request } = useApi();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasUsuarios | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [formulario, setFormulario] = useState<FormularioUsuario>({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    nivel_acceso: 'ADMIN_NIVEL_1',
    cargo: '',
    telefono: '',
    password: '',
    password_confirm: '',
    activo: true
  });
  const [filtros, setFiltros] = useState({
    busqueda: '',
    nivel_acceso: '',
    activo: ''
  });
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      await Promise.all([
        cargarUsuarios(),
        cargarEstadisticas()
      ]);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setCargando(false);
    }
  };

  const cargarUsuarios = async () => {
    try {
      const respuesta = await request<{ results: Usuario[] } | Usuario[]>({
        method: 'GET',
        url: '/usuarios/usuarios/'
      });

      // Manejar respuestas paginadas vs arrays directos
      const usuariosData = Array.isArray(respuesta) ? respuesta : (respuesta as any)?.results || [];
      setUsuarios(usuariosData);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      setMensajeError('Error al cargar usuarios');
    }
  };

  const cargarEstadisticas = async () => {
    try {
      const respuesta = await request<EstadisticasUsuarios>({
        method: 'GET',
        url: '/usuarios/usuarios/estadisticas/'
      });
      setEstadisticas(respuesta);
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      // Si no hay endpoint de estadísticas, calcular localmente
      const usuariosResp = await request<{ results: Usuario[] } | Usuario[]>({
        method: 'GET',
        url: '/usuarios/usuarios/'
      });
      const usuariosData = Array.isArray(usuariosResp) ? usuariosResp : (usuariosResp as any)?.results || [];

      const estadisticasLocal: EstadisticasUsuarios = {
        total_usuarios: usuariosData.length,
        usuarios_por_nivel: {
          'ADMIN_TOTAL': {
            nombre: 'Administrador Total',
            cantidad: usuariosData.filter(u => u.nivel_acceso === 'ADMIN_TOTAL').length
          },
          'ADMIN_NIVEL_2': {
            nombre: 'Administrador Nivel 2',
            cantidad: usuariosData.filter(u => u.nivel_acceso === 'ADMIN_NIVEL_2').length
          },
          'ADMIN_NIVEL_1': {
            nombre: 'Administrador Nivel 1',
            cantidad: usuariosData.filter(u => u.nivel_acceso === 'ADMIN_NIVEL_1').length
          }
        }
      };
      setEstadisticas(estadisticasLocal);
    }
  };

  const manejarEnvioFormulario = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setMensajeError('');
    setMensajeExito('');

    try {
      // Validar contraseñas si es nuevo usuario
      if (!usuarioEditando) {
        if (formulario.password !== formulario.password_confirm) {
          setMensajeError('Las contraseñas no coinciden');
          setEnviando(false);
          return;
        }
        if (formulario.password.length < 6) {
          setMensajeError('La contraseña debe tener al menos 6 caracteres');
          setEnviando(false);
          return;
        }
      }

      if (usuarioEditando) {
        // Actualizar usuario existente
        await request({
          method: 'PUT',
          url: `/usuarios/usuarios/${usuarioEditando.id}/`,
          data: {
            username: formulario.username,
            email: formulario.email,
            first_name: formulario.first_name,
            last_name: formulario.last_name,
            nivel_acceso: formulario.nivel_acceso,
            cargo: formulario.cargo,
            telefono: formulario.telefono,
            activo: formulario.activo
          }
        });
        setMensajeExito('Usuario actualizado correctamente');
      } else {
        // Crear nuevo usuario
        await request({
          method: 'POST',
          url: '/usuarios/usuarios/',
          data: formulario
        });
        setMensajeExito('Usuario creado correctamente');
      }

      setMostrarFormulario(false);
      setUsuarioEditando(null);
      setFormulario({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        nivel_acceso: 'ADMIN_NIVEL_1',
        cargo: '',
        telefono: '',
        password: '',
        password_confirm: '',
        activo: true
      });

      await cargarDatos();

      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setMensajeExito(''), 3000);
    } catch (error: any) {
      console.error('Error enviando formulario:', error);
      setMensajeError(error?.response?.data?.message || 'Error al guardar usuario');
    } finally {
      setEnviando(false);
    }
  };

  const eliminarUsuario = async (usuario: Usuario) => {
    if (!confirm(`¿Está seguro de desactivar el usuario ${usuario.username}?`)) {
      return;
    }

    try {
      await request({
        method: 'DELETE',
        url: `/usuarios/usuarios/${usuario.id}/`
      });
      setMensajeExito('Usuario desactivado correctamente');
      await cargarDatos();
      setTimeout(() => setMensajeExito(''), 3000);
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      setMensajeError('Error al desactivar usuario');
    }
  };

  const abrirEdicion = (usuario: Usuario) => {
    setUsuarioEditando(usuario);
    setFormulario({
      username: usuario.username,
      email: usuario.email,
      first_name: usuario.first_name,
      last_name: usuario.last_name,
      nivel_acceso: usuario.nivel_acceso,
      cargo: usuario.cargo || '',
      telefono: usuario.telefono || '',
      password: '',
      password_confirm: '',
      activo: usuario.activo
    });
    setMostrarFormulario(true);
  };

  const obtenerColorNivel = (nivel: string) => {
    switch (nivel) {
      case 'ADMIN_TOTAL':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      case 'ADMIN_NIVEL_2':
        return 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300';
      case 'ADMIN_NIVEL_1':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300';
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-300';
    }
  };

  const usuariosFiltrados = usuarios.filter(usuario => {
    const cumpleBusqueda = !filtros.busqueda ||
      usuario.username.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
      usuario.first_name.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
      usuario.last_name.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
      usuario.email.toLowerCase().includes(filtros.busqueda.toLowerCase());

    const cumpleNivel = !filtros.nivel_acceso || usuario.nivel_acceso === filtros.nivel_acceso;
    const cumpleActivo = filtros.activo === '' || usuario.activo.toString() === filtros.activo;

    return cumpleBusqueda && cumpleNivel && cumpleActivo;
  });

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Mensajes de alerta */}
        {mensajeError && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg flex items-center justify-between">
            <span>{mensajeError}</span>
            <button onClick={() => setMensajeError('')} className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-200">✕</button>
          </div>
        )}
        {mensajeExito && (
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-lg flex items-center justify-between">
            <span>{mensajeExito}</span>
            <button onClick={() => setMensajeExito('')} className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-200">✕</button>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Gestión de Usuarios
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Administra los usuarios y sus permisos en el sistema
              </p>
            </div>
            <button
              onClick={() => setMostrarFormulario(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlusIcon className="h-5 w-5" />
              Nuevo Usuario
            </button>
          </div>
        </div>

        {/* Estadísticas */}
        {estadisticas && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <ShieldCheckIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Usuarios</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{estadisticas.total_usuarios}</p>
                </div>
              </div>
            </div>

            {Object.entries(estadisticas.usuarios_por_nivel).map(([nivel, info]) => (
              <div key={nivel} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${obtenerColorNivel(nivel)}`}>
                    <ShieldCheckIcon className="h-6 w-6" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{info.nombre}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{info.cantidad}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Buscar
              </label>
              <input
                type="text"
                value={filtros.busqueda}
                onChange={(e) => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
                placeholder="Nombre, usuario o email..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nivel de Acceso
              </label>
              <select
                value={filtros.nivel_acceso}
                onChange={(e) => setFiltros(prev => ({ ...prev, nivel_acceso: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
              >
                <option value="">Todos los niveles</option>
                <option value="ADMIN_TOTAL">Administrador Total</option>
                <option value="ADMIN_NIVEL_2">Administrador Nivel 2</option>
                <option value="ADMIN_NIVEL_1">Administrador Nivel 1</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Estado
              </label>
              <select
                value={filtros.activo}
                onChange={(e) => setFiltros(prev => ({ ...prev, activo: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
              >
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Nivel de Acceso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Cargo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Última Actividad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {usuario.first_name.charAt(0)}{usuario.last_name.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {usuario.first_name} {usuario.last_name}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            @{usuario.username} • {usuario.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${obtenerColorNivel(usuario.nivel_acceso)}`}>
                        {usuario.nivel_acceso_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                      {usuario.cargo || 'Sin especificar'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      {new Date(usuario.ultima_actividad).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        usuario.activo
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                      }`}>
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => abrirEdicion(usuario)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          title="Editar usuario"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setMensajeError('Funcionalidad de cambio de contraseña pendiente de implementación');
                            setTimeout(() => setMensajeError(''), 3000);
                          }}
                          className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300"
                          title="Cambiar contraseña"
                        >
                          <KeyIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => eliminarUsuario(usuario)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          title="Desactivar usuario"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal/Formulario */}
        {mostrarFormulario && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {usuarioEditando ? 'Editar Usuario' : 'Nuevo Usuario'}
                  </h2>
                  <button
                    onClick={() => {
                      setMostrarFormulario(false);
                      setUsuarioEditando(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={manejarEnvioFormulario} className="space-y-4">
                  {mensajeError && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg text-sm">
                      {mensajeError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nombre de usuario *
                      </label>
                      <input
                        type="text"
                        value={formulario.username}
                        onChange={(e) => setFormulario(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={formulario.email}
                        onChange={(e) => setFormulario(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={formulario.first_name}
                        onChange={(e) => setFormulario(prev => ({ ...prev, first_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Apellido *
                      </label>
                      <input
                        type="text"
                        value={formulario.last_name}
                        onChange={(e) => setFormulario(prev => ({ ...prev, last_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nivel de Acceso *
                      </label>
                      <select
                        value={formulario.nivel_acceso}
                        onChange={(e) => setFormulario(prev => ({ ...prev, nivel_acceso: e.target.value as any }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                        required
                      >
                        <option value="ADMIN_NIVEL_1">Administrador Nivel 1</option>
                        <option value="ADMIN_NIVEL_2">Administrador Nivel 2</option>
                        <option value="ADMIN_TOTAL">Administrador Total</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Cargo
                      </label>
                      <input
                        type="text"
                        value={formulario.cargo}
                        onChange={(e) => setFormulario(prev => ({ ...prev, cargo: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                        placeholder="Ej: Vendedor, Contador, etc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={formulario.telefono}
                        onChange={(e) => setFormulario(prev => ({ ...prev, telefono: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                        placeholder="+54 9 11 1234-5678"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="activo"
                        checked={formulario.activo}
                        onChange={(e) => setFormulario(prev => ({ ...prev, activo: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 rounded"
                      />
                      <label htmlFor="activo" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">
                        Usuario activo
                      </label>
                    </div>
                  </div>

                  {!usuarioEditando && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Contraseña *
                        </label>
                        <input
                          type="password"
                          value={formulario.password}
                          onChange={(e) => setFormulario(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                          required={!usuarioEditando}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Confirmar Contraseña *
                        </label>
                        <input
                          type="password"
                          value={formulario.password_confirm}
                          onChange={(e) => setFormulario(prev => ({ ...prev, password_confirm: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white"
                          required={!usuarioEditando}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarFormulario(false);
                        setUsuarioEditando(null);
                      }}
                      className="px-4 py-2 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={enviando}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {enviando && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                      {usuarioEditando ? 'Actualizar' : 'Crear'} Usuario
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsuariosPage;