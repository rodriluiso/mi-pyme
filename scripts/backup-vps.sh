#!/bin/bash
# Script de backup automático para VPS

set -e

# Configuración
BACKUP_DIR="/backups/pyme"
APP_DIR="/home/pyme/app"
DB_NAME="pyme_db"
DB_USER="pyme_user"
RETENTION_DAYS=30

# Crear directorio de backups
mkdir -p $BACKUP_DIR

# Fecha actual
DATE=$(date +%Y%m%d_%H%M%S)

echo "========================================="
echo "  Backup Sistema PYME - $DATE"
echo "========================================="
echo ""

# 1. Backup de PostgreSQL
echo "[1/3] Backup de base de datos..."
PGPASSWORD="change_this_password" pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz
echo "✓ Base de datos respaldada: db_$DATE.sql.gz"

# 2. Backup de archivos media
echo "[2/3] Backup de archivos media..."
if [ -d "$APP_DIR/backend/media" ]; then
    tar -czf $BACKUP_DIR/media_$DATE.tar.gz -C $APP_DIR/backend media/
    echo "✓ Archivos media respaldados: media_$DATE.tar.gz"
fi

# 3. Backup de configuración
echo "[3/3] Backup de configuración..."
tar -czf $BACKUP_DIR/config_$DATE.tar.gz -C $APP_DIR backend/.env frontend/.env 2>/dev/null || true
echo "✓ Configuración respaldada: config_$DATE.tar.gz"

# Crear backup completo
echo ""
echo "Creando archivo de backup completo..."
tar -czf $BACKUP_DIR/full_backup_$DATE.tar.gz -C $BACKUP_DIR \
    db_$DATE.sql.gz \
    media_$DATE.tar.gz \
    config_$DATE.tar.gz 2>/dev/null || true

# Limpiar archivos individuales
rm -f $BACKUP_DIR/db_$DATE.sql.gz
rm -f $BACKUP_DIR/media_$DATE.tar.gz
rm -f $BACKUP_DIR/config_$DATE.tar.gz

# Eliminar backups antiguos
echo "Limpiando backups antiguos (más de $RETENTION_DAYS días)..."
find $BACKUP_DIR -name "full_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Mostrar espacio usado
BACKUP_SIZE=$(du -sh $BACKUP_DIR | cut -f1)

echo ""
echo "========================================="
echo "  ✓ Backup Completado"
echo "========================================="
echo ""
echo "Archivo: $BACKUP_DIR/full_backup_$DATE.tar.gz"
echo "Tamaño total backups: $BACKUP_SIZE"
echo ""
echo "Backups disponibles:"
ls -lh $BACKUP_DIR/full_backup_*.tar.gz 2>/dev/null | tail -5
echo ""

# Opcional: Copiar a almacenamiento remoto (descomentar y configurar)
# echo "Copiando a almacenamiento remoto..."
# rsync -avz $BACKUP_DIR/full_backup_$DATE.tar.gz user@backup-server:/backups/
# O usar rclone para S3, Google Drive, etc.
# rclone copy $BACKUP_DIR/full_backup_$DATE.tar.gz remote:backups/
