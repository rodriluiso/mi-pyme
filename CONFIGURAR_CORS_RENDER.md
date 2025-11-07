# Guía: Solucionar Error 403 (CORS) en Render

## El Problema

Tu aplicación funciona correctamente en el login, pero al intentar cargar datos (clientes, productos, etc.) desde el celular, obtienes error **403 Forbidden**.

**Causa Principal**: Django no puede compartir cookies de sesión entre `mipyme-backend.onrender.com` y `mipyme-frontend.onrender.com` porque falta la configuración de `SESSION_COOKIE_DOMAIN`.

**Causa Secundaria**: El backend Django en Render solo está permitiendo peticiones desde `https://localhost`, pero tu frontend está en `https://mipyme-frontend.onrender.com`.

## Solución: Configurar Variables de Entorno en Render

### Paso 1: Ir al Dashboard de Render

1. Abre: https://dashboard.render.com
2. Inicia sesión con tu cuenta
3. Busca tu servicio de **backend** (Django/Python)
4. Haz clic en el servicio para abrirlo

### Paso 2: Ir a Environment Variables

1. En el menú lateral izquierdo, haz clic en **"Environment"**
2. Verás una lista de variables de entorno

### Paso 3: Actualizar/Agregar Variables

Necesitas actualizar o agregar estas 2 variables:

#### Variable 1: DJANGO_CORS_ALLOWED_ORIGINS

**Si ya existe:**
- Busca `DJANGO_CORS_ALLOWED_ORIGINS`
- Haz clic en el botón de editar (lápiz)
- Reemplaza el valor con:
  ```
  https://mipyme-frontend.onrender.com
  ```

**Si NO existe:**
- Haz clic en **"Add Environment Variable"**
- Key: `DJANGO_CORS_ALLOWED_ORIGINS`
- Value: `https://mipyme-frontend.onrender.com`
- Haz clic en **"Save Changes"**

#### Variable 2: DJANGO_ALLOWED_HOSTS

**Si ya existe:**
- Busca `DJANGO_ALLOWED_HOSTS`
- Haz clic en el botón de editar (lápiz)
- Asegúrate que incluya (puede tener más valores separados por coma):
  ```
  mipyme-backend.onrender.com
  ```

**Si NO existe:**
- Haz clic en **"Add Environment Variable"**
- Key: `DJANGO_ALLOWED_HOSTS`
- Value: `mipyme-backend.onrender.com`
- Haz clic en **"Save Changes"**

### Paso 4: Hacer Push de Cambios en el Código

Necesitas hacer push de los cambios en el código al repositorio:

1. Los cambios ya están hechos localmente en `backend/core/settings/prod.py`
2. Ve a tu terminal y ejecuta:
   ```bash
   git add backend/core/settings/prod.py CONFIGURAR_CORS_RENDER.md
   git commit -m "fix: configurar SESSION_COOKIE_DOMAIN para compartir cookies entre subdomains"
   git push
   ```

### Paso 5: Redeploy el Backend

Después de hacer el push:

1. Render debería hacer un **Auto-Deploy** automáticamente al detectar el nuevo commit
2. Si no, haz clic en **"Manual Deploy"** → **"Deploy latest commit"**
3. Espera 2-3 minutos a que termine el deploy

### Paso 6: Verificar

1. Abre tu frontend desde el celular: https://mipyme-frontend.onrender.com
2. Inicia sesión
3. Intenta cargar clientes, productos, etc.
4. Debería funcionar correctamente ✅

## Configuración Completa Recomendada

Para que funcione desde **cualquier lugar** (web, celular, desktop app), usa esta configuración:

### DJANGO_CORS_ALLOWED_ORIGINS
```
https://mipyme-frontend.onrender.com
```

Si más adelante agregas un dominio personalizado (ej: `https://tuempresa.com`), agrégalo separado por coma:
```
https://mipyme-frontend.onrender.com,https://tuempresa.com
```

### DJANGO_ALLOWED_HOSTS
```
mipyme-backend.onrender.com
```

Si usas dominio personalizado:
```
mipyme-backend.onrender.com,api.tuempresa.com
```

## ¿Por Qué Sucedió Esto?

Hay DOS problemas de seguridad relacionados que causaron el error 403:

### 1. Problema de Cookies de Sesión (Principal)

Django usa **cookies de sesión** para mantener tu login activo. Cuando inicias sesión, Django crea una cookie y la asocia al dominio `mipyme-backend.onrender.com`.

El problema es que cuando tu navegador hace peticiones desde `mipyme-frontend.onrender.com`, **no envía la cookie** porque está atada a un dominio diferente (aunque sean subdominos del mismo dominio base).

**Solución**: Configurar `SESSION_COOKIE_DOMAIN = '.onrender.com'` permite que la cookie sea compartida entre TODOS los subdominios de `onrender.com` (mipyme-backend, mipyme-frontend, etc.).

### 2. Problema de CORS (Secundario)

Django tiene seguridad **CORS** (Cross-Origin Resource Sharing) que evita que otros sitios web accedan a tu API sin permiso. Es una medida de seguridad importante.

El backend necesita **explícitamente** permitir peticiones desde el frontend. Como el frontend y backend están en diferentes URLs (dominios cruzados), Django bloquea las peticiones por defecto.

## Logs para Verificar

Después del deploy, puedes verificar los logs en Render:

1. Ve a tu servicio backend
2. Haz clic en **"Logs"** en el menú lateral
3. Busca líneas como:
   ```
   CORS configured with origins: ['https://mipyme-frontend.onrender.com']
   ```

## Troubleshooting

### Si sigue sin funcionar después de configurar:

1. **Verifica que el deploy terminó correctamente**
   - Ve a "Logs" y asegúrate que no haya errores
   - Busca: "Application startup complete"

2. **Limpia caché del navegador/celular**
   - En el celular: Settings → Clear browsing data
   - O usa modo incógnito

3. **Verifica las URLs exactas**
   - Asegúrate que `CORS_ALLOWED_ORIGINS` use **HTTPS** (no HTTP)
   - Asegúrate que no haya espacios antes/después de las URLs
   - No termines las URLs con `/`

4. **Revisa los logs de error en el navegador**
   - Abre DevTools en Chrome/Firefox (F12)
   - Ve a la pestaña "Console"
   - Busca errores de CORS

## Contacto de Soporte

Si necesitas ayuda adicional, puedes:
- Revisar los logs de Render para errores específicos
- Verificar la configuración en el archivo de settings de Django
- Consultar la documentación de Render: https://render.com/docs
