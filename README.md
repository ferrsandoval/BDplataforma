# ProfilerMX — Motor de Enriquecimiento de Perfiles

Plataforma standalone para evaluación de riesgo crediticio mediante enriquecimiento de datos públicos e internos.

## Inicio rápido

```bash
# 1. Clonar y entrar al directorio
cd BDPlataforma

# 2. Copiar variables de entorno
cp .env.example backend/.env

# 3. Levantar todos los servicios
docker compose up --build
```

**URLs disponibles:**
- Frontend: http://localhost:5173
- API: http://localhost:8000
- Docs API: http://localhost:8000/docs

## Capas de datos

| Capa | Fuente | Worker |
|------|--------|--------|
| 4 — Pública | OFAC SDN, SAT deudores, DOF, RPP, noticias, redes sociales | `blacklist_worker`, `records_worker`, `news_worker`, `social_worker` |
| 5 — Interna | PostgreSQL (historial de créditos, scores, referencias) | `internal_worker` |

## Estructura

```
backend/          FastAPI + Celery
  api/            Rutas REST
  workers/        Tareas Celery (una por fuente)
  services/       Normalizador, scorer, caché Redis
  db/             MongoDB (perfiles) + PostgreSQL (historial)
frontend/         React 19 + Vite + Tailwind v4
  pages/          Dashboard, NuevaBúsqueda, Perfil
  components/     RiskBadge, StatusPoller, ProfileCard, etc.
```

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `REDIS_URL` | URL del broker Celery y caché | `redis://localhost:6379` |
| `MONGODB_URL` | URL de MongoDB | `mongodb://localhost:27017` |
| `MONGODB_DB` | Nombre de la base de datos | `profilermx` |
| `POSTGRES_URL` | URL de PostgreSQL (Layer 5) | `postgresql://...` |
| `OFAC_API_KEY` | API key para OFAC (opcional, usa endpoint free) | `` |

## Cache

La misma combinación CURP+RFC no se re-consulta dentro de las 24 horas siguientes. El caché se invalida automáticamente al vencer el TTL en Redis.

## Niveles de riesgo

| Nivel | Criterio |
|-------|----------|
| 🔴 Alto | Hit en lista negra, registros judiciales, score <40, o >3 créditos vencidos >90 días |
| 🟡 Medio | Score 40–65, créditos con 30+ días vencidos, o >50% noticias negativas |
| 🟢 Bajo | Ninguno de los criterios anteriores |
