# 📦 MI-PYME Backup & Disaster Recovery Policy

## 🎯 Objetivos

- **RPO (Recovery Point Objective)**: ≤ 24 horas - Máximo de datos perdidos en un desastre
- **RTO (Recovery Time Objective)**: ≤ 1 hora - Tiempo máximo para restaurar el servicio
- **Retención**: 30 días de backups diarios, 90 días de backups mensuales

## 📋 Estrategia de Backup

### 1. Backups Automáticos Diarios

**Frecuencia**: Todos los días a las 2:00 AM (hora del servidor)

**Qué se respalda**:
- Base de datos completa (PostgreSQL)
- Datos de aplicación (Django fixtures)
- Archivos media (uploads de usuarios)

**Ubicación**:
- Local: `./backups/` (30 días)
- Remoto: S3/Cloud Storage (90 días) - *Recomendado para producción*

**Script**: `scripts/backup_db.sh`

### 2. Backups Manuales

**Cuándo realizar**:
- Antes de deployments importantes
- Antes de migraciones de base de datos
- Antes de actualizaciones mayores del sistema
- Cuando se solicite explícitamente

**Comando**:
```bash
./scripts/backup_db.sh
```

### 3. Backups Pre-Deploy (Automáticos)

El script de deployment (`scripts/deploy.sh`) crea automáticamente un backup antes de cada deploy.

## 🔧 Configuración

### Instalación del Cron Job (Primera vez)

```bash
# En el servidor de producción
cd /path/to/mi-pyme-dev
./scripts/setup_backup_cron.sh
```

### Verificar Configuración

```bash
# Ver cron jobs activos
crontab -l

# Ver logs de backups
tail -f /var/log/mipyme-backup.log

# Listar backups existentes
ls -lh backups/
```

### Personalizar Horario

Por defecto: 2:00 AM diario. Para cambiar:

```bash
# Editar crontab manualmente
crontab -e

# Ejemplos de horarios:
# 0 2 * * *     - Diario a las 2:00 AM
# 0 */6 * * *   - Cada 6 horas
# 0 2 * * 0     - Semanal (Domingos a las 2:00 AM)
# 0 2 1 * *     - Mensual (día 1 a las 2:00 AM)
```

## 🔄 Restauración de Backups

### Restauración Interactiva

```bash
./scripts/restore_db.sh
```

El script te mostrará backups disponibles y te pedirá confirmación.

### Restauración de un Backup Específico

```bash
# Listar backups
ls -lh backups/

# Restaurar manualmente
BACKUP_FILE=backups/mipyme_backup_20250101_020000.sql.gz
gunzip -c $BACKUP_FILE | docker-compose -f docker-compose.prod.yml exec -T backend \
    python manage.py loaddata --format=json -
```

### Safety Backup Automático

Cada vez que restauras, el sistema crea automáticamente un "safety backup" del estado actual antes de la restauración.

Ubicación: `backups/safety_before_restore_YYYYMMDD_HHMMSS.sql.gz`

## 📊 Monitoreo de Backups

### Verificación Diaria

```bash
# Último backup creado
ls -lht backups/ | head -n 2

# Verificar integridad
gunzip -t backups/mipyme_backup_*.sql.gz
```

### Alertas Recomendadas

1. **Backup no creado**: Si no hay backup en las últimas 25 horas
2. **Backup vacío**: Si el tamaño es < 1KB
3. **Backup corrupto**: Si gunzip -t falla
4. **Disco lleno**: Si queda < 10% de espacio

### Script de Verificación

```bash
#!/bin/bash
# Agregar a cron: 0 8 * * * (8 AM diario)

LATEST_BACKUP=$(ls -t backups/mipyme_backup_*.sql.gz | head -n 1)
AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))

if [ $AGE_HOURS -gt 25 ]; then
    echo "⚠️ WARNING: Last backup is $AGE_HOURS hours old!" | mail -s "MI-PYME Backup Alert" admin@example.com
fi
```

## 🌐 Backup Remoto (Recomendado para Producción)

### Opción 1: AWS S3

```bash
# Instalar AWS CLI
apt-get install awscli

# Configurar credenciales
aws configure

# Modificar backup_db.sh para subir a S3
# Agregar al final del script:
aws s3 cp "$BACKUP_FILE" "s3://mi-pyme-backups/$(basename $BACKUP_FILE)"
```

### Opción 2: Backblaze B2 (Más económico)

```bash
# Instalar B2 CLI
pip install b2

# Configurar
b2 authorize-account <key_id> <application_key>

# Subir backup
b2 upload-file mi-pyme-backups "$BACKUP_FILE" "$(basename $BACKUP_FILE)"
```

### Opción 3: rsync a Servidor Remoto

```bash
# Agregar al backup_db.sh
rsync -avz "$BACKUP_FILE" backup-server:/backups/mipyme/
```

## 🧪 Plan de Prueba de Recuperación

**Frecuencia**: Mensual (primer domingo de cada mes)

### Procedimiento de Prueba

1. **Preparación**
   ```bash
   # Crear ambiente de testing
   docker-compose -f docker-compose.test.yml up -d
   ```

2. **Restauración**
   ```bash
   # Restaurar último backup
   ./scripts/restore_db.sh
   ```

3. **Verificación**
   - [ ] Sistema arranca correctamente
   - [ ] Login funciona
   - [ ] Datos visibles y correctos
   - [ ] Operaciones CRUD funcionan
   - [ ] No hay errores en logs

4. **Documentación**
   - Registrar tiempo de restauración (debe ser < 1 hora)
   - Documentar problemas encontrados
   - Actualizar procedimientos si es necesario

### Checklist de Recuperación de Desastres

- [ ] Backup disponible y accesible
- [ ] Servidor de respaldo configurado
- [ ] Credenciales de acceso disponibles
- [ ] DNS puede apuntar a nuevo servidor
- [ ] Certificados SSL disponibles
- [ ] Variables de entorno documentadas
- [ ] Equipo notificado y disponible

## 📁 Estructura de Backups

```
backups/
├── mipyme_backup_20250101_020000.sql.gz    # Backup diario automático
├── mipyme_backup_20250102_020000.sql.gz
├── pre_deploy_20250102_150000.sql.gz       # Backup pre-deploy
├── safety_before_restore_20250102_160000.sql.gz  # Safety backup
└── monthly/
    ├── mipyme_backup_202501.sql.gz          # Backup mensual (90 días)
    └── mipyme_backup_202502.sql.gz
```

## 🔐 Seguridad de Backups

### Cifrado (Recomendado para Producción)

```bash
# Modificar backup_db.sh para cifrar
# Agregar después de crear el backup:

# Cifrar con GPG
gpg --symmetric --cipher-algo AES256 "$BACKUP_FILE"
rm "$BACKUP_FILE"  # Eliminar backup sin cifrar

# Para restaurar:
gpg --decrypt "$BACKUP_FILE.gpg" | gunzip | docker-compose exec -T backend python manage.py loaddata --format=json -
```

### Permisos

```bash
# Solo root/admin puede leer backups
chmod 600 backups/*.sql.gz
chown root:root backups/

# Directorio de backups
chmod 700 backups/
```

## 📞 Contactos de Emergencia

| Rol | Nombre | Contacto | Disponibilidad |
|-----|--------|----------|----------------|
| Admin Principal | - | - | 24/7 |
| Backup Admin | - | - | Lun-Vie 9-18 |
| Proveedor Hosting | - | - | Según contrato |

## 📚 Referencias

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [Django Backup Best Practices](https://docs.djangoproject.com/en/stable/ref/django-admin/#dumpdata)
- Política de Retención: `scripts/backup_db.sh` (línea 31)

---

**Última actualización**: 2025-01-03
**Próxima revisión**: 2025-04-03
**Versión**: 1.0
