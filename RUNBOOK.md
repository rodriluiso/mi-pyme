# MI-PYME Production Runbook

## Quick Commands

### Service Management
```bash
# Start all
docker-compose -f docker-compose.prod.yml up -d

# Stop all
docker-compose -f docker-compose.prod.yml down

# Restart backend
docker-compose -f docker-compose.prod.yml restart backend

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Status
docker-compose -f docker-compose.prod.yml ps
```

### Deploy New Version
```bash
./scripts/deploy.sh
```

### Database Operations
```bash
# Migrations
docker-compose -f docker-compose.prod.yml run --rm backend python manage.py migrate

# Backup
./scripts/backup_db.sh

# Shell
docker-compose -f docker-compose.prod.yml exec backend python manage.py shell

# DB Shell
docker-compose -f docker-compose.prod.yml exec backend python manage.py dbshell
```

### Health Checks
```bash
curl http://localhost/api/health/
curl http://localhost/api/ready/
```

## Troubleshooting

### Service Won't Start
1. Check logs: `docker-compose logs backend`
2. Verify env vars: `docker-compose config`
3. Check port conflicts: `netstat -tulpn | grep :8000`

### High Error Rate
1. Check logs for exceptions
2. Verify database connection
3. Check memory: `docker stats`
4. Restart: `docker-compose restart backend`

### Database Issues
1. Check connection: `docker-compose exec backend python manage.py check --database default`
2. View active queries in DB
3. Restart database connection pool

### Disk Full
```bash
# Clean Docker
docker system prune -af

# Clean old backups
find backups/ -mtime +30 -delete

# Check disk
df -h
```

## Emergency Procedures

### Rollback
```bash
git reset --hard <commit>
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

### Restore Backup
```bash
gunzip < backups/backup_file.sql.gz | \
  docker-compose exec -T backend python manage.py loaddata --format=json -
```

## Monitoring

### Key Metrics
- Error rate: < 1%
- Response time p95: < 800ms
- Database connections: < 80% of max
- Disk usage: < 70%

### Log Locations
- Backend: `docker-compose logs backend`
- Nginx: `docker-compose logs nginx`
- System: `/var/log/syslog`

## Contacts
- Tech Lead: [EMAIL]
- On-Call: [PHONE]
