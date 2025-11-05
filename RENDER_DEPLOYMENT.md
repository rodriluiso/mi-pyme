# Guía de Deployment en Render.com - MI-PYME

## 📋 Pre-requisitos

✅ Cuenta en Render.com creada
✅ Código en GitHub (o GitLab/Bitbucket)
✅ Base de datos limpiada (`python manage.py flush`)
✅ Frontend compilado (`npm run build`)
✅ Variables de entorno configuradas

---

## 🚀 Pasos para el Deployment

### 1. Subir código a GitHub

Si aún no has subido el código a GitHub:

```bash
# Inicializar Git (si no está inicializado)
git init
git add .
git commit -m "feat: preparar para deployment en Render"

# Crear repositorio en GitHub y conectar
git remote add origin https://github.com/TU-USUARIO/mi-pyme.git
git branch -M main
git push -u origin main
```

### 2. Conectar Render con GitHub

1. Ve a [https://dashboard.render.com](https://dashboard.render.com)
2. Click en **"New +"** en la esquina superior derecha
3. Selecciona **"Blueprint"**
4. Conecta tu repositorio de GitHub
5. Selecciona el repositorio `mi-pyme`
6. Render detectará automáticamente el archivo `render.yaml`

### 3. Configurar Variables de Entorno

Una vez que Render lea el `render.yaml`, necesitas configurar las variables de entorno manualmente:

#### Para el servicio `mipyme-backend`:

1. Ve a **Dashboard** → **mipyme-backend** → **Environment**
2. Agrega las siguientes variables:

```bash
# IMPORTANTE: Estas variables se configuran automáticamente desde render.yaml
# Solo necesitas añadir FERNET_KEY manualmente

FERNET_KEY=<genera-un-nuevo-key>
```

**Generar FERNET_KEY:**

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copia el resultado y pégalo en Render.

#### Variables que Render configura automáticamente:

-  `DATABASE_URL` - Conectada desde la base de datos PostgreSQL
-  `DJANGO_SECRET_KEY` - Generada automáticamente
-  `DJANGO_DEBUG=False`
-  `DJANGO_ALLOWED_HOSTS=.onrender.com`
-  `DJANGO_SETTINGS_MODULE=core.settings`
- ✅ `DJANGO_CORS_ALLOWED_ORIGINS` - URL del backend

### 4. Iniciar el Deployment

1. Click en **"Create Blueprint Instance"**
2. Render creará automáticamente:
   - 📦 Base de datos PostgreSQL (`mipyme-db`)
   - 🐍 Backend Django (`mipyme-backend`)
   - ⚛️ Frontend React (`mipyme-frontend`)

3. Espera a que todos los servicios estén **"Live"** (⚫→🟢)

**Tiempo estimado:** 10-15 minutos

---

## 🔍 Verificación Post-Deployment

### Backend Health Check

```bash
curl https://mipyme-backend.onrender.com/api/health/
```

**Respuesta esperada:**

```json
{
  "status": "healthy",
  "database": "ok",
  "cache": "unavailable: ...",
  "version": "1.0.0"
}
```

### Frontend

Abre en tu navegador:

```
https://mipyme-frontend.onrender.com
```

Deberías ver la página de login.

### Crear usuario admin

Conecta al backend via Render Shell:

1. Ve a **Dashboard** → **mipyme-backend** → **Shell**
2. Ejecuta:

```bash
cd backend
python manage.py createsuperuser
```

Ingresa:
- Username: `admin`
- Email: `admin@mipyme.com`
- Password: `<tu-password-seguro>`

---

## 📊 Monitoring y Logs

### Ver logs en tiempo real:

1. **Backend**: Dashboard → mipyme-backend → Logs
2. **Frontend**: Dashboard → mipyme-frontend → Logs
3. **Database**: Dashboard → mipyme-db → Info

### Métricas:

- **CPU/Memory**: Se muestra en el dashboard de cada servicio
- **Requests**: Logs tab muestra todas las peticiones HTTP
- **Database**: Connections y queries en el dashboard de PostgreSQL

---

## 🔧 Troubleshooting

### Error: "Application failed to respond"

**Causa**: El backend no está iniciando correctamente.

**Solución**:

1. Revisa los logs: Dashboard → mipyme-backend → Logs
2. Verifica que todas las variables de entorno estén configuradas
3. Verifica que las migraciones se aplicaron: `python manage.py migrate`

### Error: "Database connection failed"

**Causa**: DATABASE_URL no está configurado o es incorrecto.

**Solución**:

1. Ve a Dashboard → mipyme-backend → Environment
2. Verifica que `DATABASE_URL` esté presente
3. Si no está, reconecta la base de datos:
   - Settings → Environment → Edit
   - Busca `DATABASE_URL` y selecciona `mipyme-db` del dropdown

### Error: Frontend muestra 404

**Causa**: El build del frontend falló.

**Solución**:

1. Ve a Dashboard → mipyme-frontend → Logs
2. Busca errores en el build
3. Verifica que `frontend/dist` se haya generado correctamente
4. Haz un redeploy manual: Dashboard → mipyme-frontend → Manual Deploy → "Deploy latest commit"

### Error: CORS bloqueando requests

**Causa**: `DJANGO_CORS_ALLOWED_ORIGINS` no incluye la URL del frontend.

**Solución**:

1. Ve a Dashboard → mipyme-backend → Environment
2. Edita `DJANGO_CORS_ALLOWED_ORIGINS`
3. Asegúrate de incluir: `https://mipyme-frontend.onrender.com`
4. Reinicia el servicio

---

## 💰 Costos (Plan Free)

| Servicio | Plan | Costo | Límites |
|----------|------|-------|---------|
| PostgreSQL | Free | $0/mes | 256 MB RAM, 1 GB storage |
| Backend (Django) | Free | $0/mes | 512 MB RAM, suspende después de 15 min inactivo |
| Frontend (Static) | Free | $0/mes | 100 GB bandwidth/mes |

**Total:** $0/mes

### Limitaciones del plan Free:

- ⚠️ **Suspensión automática**: Los servicios web se suspenden después de 15 minutos de inactividad
- ⏱️ **Cold start**: Primera petición después de suspensión toma ~30 segundos
- 📊 **750 horas/mes**: Límite de horas de ejecución (suficiente para uso ocasional)

### Migrar a plan Paid:

Para producción real, considera:

- **Starter Plan ($7/mes)**: Sin suspensión, 512 MB RAM persistente
- **Standard Plan ($25/mes)**: 2 GB RAM, mejor rendimiento
- **PostgreSQL Starter ($7/mes)**: 1 GB RAM, backups automáticos

---

## 🔄 Actualizaciones y CI/CD

### Deploy automático desde GitHub:

Render hace deploy automático cuando:
1. Haces `git push` a la rama `main`
2. El commit pasa por el build process
3. Se despliega automáticamente si el build es exitoso

### Deploy manual:

1. Ve a Dashboard → [servicio] → Manual Deploy
2. Selecciona el branch/commit
3. Click "Deploy"

### Rollback:

1. Ve a Dashboard → [servicio] → Events
2. Encuentra el deploy anterior que funcionaba
3. Click en el botón de rollback

---

## 🔐 Seguridad Post-Deployment

### ✅ Checklist de seguridad:

- [ ] `DJANGO_DEBUG=False` en producción
- [ ] `DJANGO_SECRET_KEY` única y secreta (no reutilizar la de desarrollo)
- [ ] `FERNET_KEY` única y secreta
- [ ] ALLOWED_HOSTS configurado correctamente
- [ ] CORS_ALLOWED_ORIGINS restrictivo (solo tus dominios)
- [ ] Cambiar contraseña del usuario admin por defecto
- [ ] Habilitar HTTPS (Render lo hace automáticamente)
- [ ] Configurar rate limiting en producción
- [ ] Revisar logs regularmente

---

## 📚 Recursos Adicionales

- [Documentación de Render](https://render.com/docs)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
- [React Production Build](https://react.dev/learn/start-a-new-react-project#production-grade-react-frameworks)

---

## 🆘 Soporte

Si encuentras problemas:

1. **Logs**: Siempre revisa los logs primero
2. **Docs de Render**: https://render.com/docs
3. **Community**: https://community.render.com
4. **Status**: https://status.render.com (para verificar outages)

---

**¡Deployment completado!** 🎉

Tu aplicación MI-PYME ahora está en producción y accesible desde cualquier lugar.
