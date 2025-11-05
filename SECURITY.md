# Guía de Seguridad - Mi-PyME

## 📋 Resumen de Mejoras Implementadas

Este documento detalla las mejoras de seguridad implementadas en el proyecto Mi-PyME para proteger la aplicación y los datos de los usuarios.

---

## 🔒 Cambios Críticos Implementados

### 1. Variables de Entorno Obligatorias

**Archivo**: `backend/core/settings.py`

- ✅ **SECRET_KEY obligatoria**: Removido valor por defecto inseguro. Ahora el sistema **requiere** que se defina `DJANGO_SECRET_KEY` en el archivo `.env`
- ✅ **DEBUG=False por defecto**: Cambio de `DEBUG=True` a `DEBUG=False` por defecto para evitar exposición de información sensible
- ✅ **ALLOWED_HOSTS obligatorio**: En producción (DEBUG=False), el sistema requiere definir hosts permitidos

**Acción requerida**:
```bash
# Generar SECRET_KEY
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'

# Agregar al archivo .env
DJANGO_SECRET_KEY=<clave_generada>
DJANGO_DEBUG=True  # Solo para desarrollo
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
```

---

### 2. Autenticación en Todos los Endpoints

**Archivos modificados**: Todos los archivos `views.py` en las apps

Se agregó `permission_classes = [IsAuthenticated]` a **TODOS** los ViewSets:

- ✅ `ClienteViewSet` y `SucursalClienteViewSet`
- ✅ `VentaViewSet`
- ✅ `ProductoViewSet`
- ✅ `ProveedorViewSet`
- ✅ `MateriaPrimaViewSet`, `CategoriaCompraViewSet`, `CompraViewSet`
- ✅ `EmpleadoViewSet`, `PagoEmpleadoViewSet`
- ✅ `PagoClienteViewSet`, `PagoProveedorViewSet`, `MovimientoFinancieroViewSet`
- ✅ `CuentaBancariaViewSet`, `ExtractoBancarioViewSet`, `MovimientoBancarioViewSet`
- ✅ `ConciliacionBancariaViewSet`, `ConfiguracionAFIPViewSet`
- ✅ `FacturaElectronicaViewSet`, `DetalleFacturaElectronicaViewSet`, `LogAFIPViewSet`
- ✅ `MovimientoStockViewSet`, `AjusteInventarioViewSet`, `OrdenProduccionViewSet`, `ValorizacionInventarioViewSet`
- ✅ `PlanCuentasViewSet`, `AsientoContableViewSet`, `ReportesFinancierosViewSet`

**Impacto**: Ahora **NO** hay endpoints públicos sin autenticación. Todos requieren un usuario autenticado.

---

### 3. Configuraciones de Seguridad HTTPS

**Archivo**: `backend/core/settings.py`

Se agregaron configuraciones automáticas para producción (cuando `DEBUG=False`):

```python
# Configuraciones automáticas en producción:
- SECURE_SSL_REDIRECT = True
- SECURE_PROXY_SSL_HEADER configurado para proxy reverso
- SESSION_COOKIE_SECURE = True
- CSRF_COOKIE_SECURE = True
- SECURE_HSTS_SECONDS = 31536000 (1 año)
- SECURE_HSTS_INCLUDE_SUBDOMAINS = True
- SECURE_HSTS_PRELOAD = True
- SECURE_CONTENT_TYPE_NOSNIFF = True
- SECURE_BROWSER_XSS_FILTER = True
- SECURE_REFERRER_POLICY = 'same-origin'
- X_FRAME_OPTIONS = 'DENY'
- PASSWORD_RESET_TIMEOUT = 3600 (1 hora)
```

**Impacto**: En producción, la aplicación fuerza el uso de HTTPS y activa protecciones del navegador.

---

### 4. Archivo .env.example Mejorado

**Archivo**: `backend/.env.example`

Se actualizó con:
- Documentación completa de cada variable
- Instrucciones para generar SECRET_KEY
- Valores de ejemplo seguros
- Notas de seguridad importantes
- Configuraciones comentadas para HTTPS

---

## 🛡️ Medidas de Seguridad Existentes

### Autenticación y Autorización
- ✅ Modelo de usuario personalizado con 3 niveles de acceso
- ✅ Sistema de permisos personalizado (`IsAdminTotal`, `CanManageUsers`, etc.)
- ✅ Logs de acceso con IP y user agent
- ✅ Validadores de contraseña de Django

### Protección de Datos
- ✅ Variables de entorno con `.env`
- ✅ `.env` excluido del repositorio vía `.gitignore`
- ✅ Django ORM (protección contra SQL injection)
- ✅ Serializers DRF (validación automática de inputs)

### Middlewares de Seguridad
- ✅ SecurityMiddleware
- ✅ CsrfViewMiddleware
- ✅ XFrameOptionsMiddleware (clickjacking)
- ✅ CORS configurado con orígenes específicos

### Gestión de Sesiones
- ✅ Timeout de 30 minutos
- ✅ Expiración al cerrar navegador
- ✅ Actualización de sesión en cada request

---

## ⚠️ Tareas Pendientes Recomendadas

### Alta Prioridad

1. **Remover .env del repositorio** (si fue commiteado):
```bash
git rm --cached backend/.env
git commit -m "Remove .env from repository"
```

2. **Migrar a PostgreSQL en producción**:
   - SQLite no es adecuado para producción
   - Configurar PostgreSQL y actualizar `DATABASES` en settings

3. **Implementar Rate Limiting**:
```bash
pip install django-ratelimit
```

### Prioridad Media

4. **Configurar Backups Automatizados**:
   - Implementar backup diario de la base de datos
   - Almacenamiento seguro de backups

5. **Implementar Logging de Seguridad**:
```bash
pip install django-auditlog
```

6. **Validación de Archivos Subidos**:
   - Validar extensiones y contenido de archivos
   - Límite de tamaño de archivos

7. **Content Security Policy (CSP)**:
```bash
pip install django-csp
```

8. **Monitoreo de Errores**:
```bash
pip install sentry-sdk
```

### Prioridad Baja

9. **Autenticación de Dos Factores (2FA)**:
```bash
pip install django-otp
```

10. **Auditoría de Dependencias**:
```bash
pip install safety
safety check
```

---

## 📝 Checklist de Despliegue a Producción

Antes de desplegar a producción, verificar:

- [ ] `DJANGO_SECRET_KEY` generada y configurada
- [ ] `DJANGO_DEBUG=False`
- [ ] `DJANGO_ALLOWED_HOSTS` configurado con dominio real
- [ ] PostgreSQL configurado y migraciones aplicadas
- [ ] HTTPS configurado (certificado SSL)
- [ ] Archivos estáticos servidos correctamente
- [ ] Backups automatizados configurados
- [ ] Variables de entorno de producción configuradas
- [ ] Firewall configurado
- [ ] Logs configurados y monitoreados
- [ ] `backend/.env` NO está en el repositorio
- [ ] Contraseñas fuertes para base de datos
- [ ] Rate limiting configurado
- [ ] Monitoreo de errores activo

---

## 🔐 Buenas Prácticas

1. **Contraseñas**:
   - Mínimo 12 caracteres
   - Combinar mayúsculas, minúsculas, números y símbolos
   - Usar gestor de contraseñas

2. **Actualizaciones**:
   - Mantener Django y dependencias actualizadas
   - Revisar parches de seguridad regularmente

3. **Principio de Mínimo Privilegio**:
   - Usuarios solo con permisos necesarios
   - Revisar permisos regularmente

4. **Monitoreo**:
   - Revisar logs de acceso regularmente
   - Alertas automáticas para actividad sospechosa

5. **Backups**:
   - Backups diarios automáticos
   - Probar restauración regularmente
   - Almacenar en ubicación separada

---

## 📞 Contacto

Para reportar vulnerabilidades de seguridad, por favor contacte a los administradores del sistema directamente (NO abrir issues públicos para problemas de seguridad).

---

**Última actualización**: 2025-10-09
**Versión**: 1.0.0
