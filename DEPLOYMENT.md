# Despliegue en producción

Arquitectura desplegada, toda en planes gratuitos. Este documento existe para
poder reconstruir el entorno desde cero o levantarlo en otra máquina.

## Servicios

| Pieza | Proveedor | URL |
|---|---|---|
| Frontend (static site) | Render | https://static-site-c9hm.onrender.com |
| Backend (FastAPI) | Render | https://bdplataforma.onrender.com |
| MongoDB (perfiles) | MongoDB Atlas | — |
| Redis (caché) | Render Key Value | — |
| PostgreSQL (Capa 5) | Neon | — |

No hay worker de Celery: Render no ofrece background workers en plan gratuito.
No hace falta, porque `POST /api/enrich` detecta la ausencia de workers y corre
el pipeline en proceso vía `BackgroundTasks` (ver `api/routes/enrichment.py`).

Verificar que todo esté conectado:

```bash
curl https://bdplataforma.onrender.com/health
# {"status":"ok","mongodb":true,"redis":true,"postgresql":true}
```

## Backend — configuración en Render

Variables de entorno (Dashboard → servicio → Environment). Los valores reales
**no** están en el repo; se consultan en el dashboard de cada proveedor.

| Variable | Dónde obtenerla |
|---|---|
| `MONGODB_URL` | Atlas → Connect → Drivers |
| `MONGODB_DB` | `profilermx` |
| `REDIS_URL` | Render → Key Value → Internal URL |
| `POSTGRES_URL` | Neon → Connection string |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `GOOGLE_API_KEY` / `GOOGLE_CX` | Google Cloud + Programmable Search |
| `RAPIDAPI_CURP_KEY` | rapidapi.com |
| `SEED_EXAMPLES` | `true` para sembrar 8 expedientes de ejemplo al arrancar |

`POSTGRES_URL` debe usar el esquema `postgresql://`, no `postgres://` — asyncpg
rechaza el segundo. El sufijo `?sslmode=require` de Neon sí es compatible.

`SEED_EXAMPLES` es idempotente: reescribe los mismos `request_id` en cada
arranque en vez de acumular duplicados. Se puede dejar activada.

## Frontend — configuración en Render

| Ajuste | Valor |
|---|---|
| Root directory | `frontend` |
| Build command | `npm install && npm run build` |
| Publish directory | `dist` |
| `VITE_API_URL` | `https://bdplataforma.onrender.com/api` |

`VITE_API_URL` se hornea en el bundle **en build time**, no en runtime: cambiarla
exige reconstruir, no solo reiniciar.

### Regla de rewrite (obligatoria)

El routing es del lado del cliente. Sin esta regla, entrar directo a `/dashboard`
o refrescar cualquier ruta profunda devuelve 404:

| Source | Destination | Action |
|---|---|---|
| `/*` | `/index.html` | **Rewrite** |

Debe ser `Rewrite`, no `Redirect`: Redirect cambiaría la URL en la barra del
navegador y React Router no vería la ruta original.

## PostgreSQL en Neon

El plan gratuito de Render Postgres **expira 30 días** después de crearse. Por eso
la Capa 5 vive en Neon, cuyo free tier no caduca.

Cargar el esquema en una base nueva:

```bash
psql "<connection-string>" -f backend/db/seed.sql
```

`seed.sql` crea las tablas con `IF NOT EXISTS`, pero los `INSERT` no llevan
`ON CONFLICT` — correrlo dos veces sobre la misma base duplica las filas.

## Límites del plan gratuito

- **Spin-down a los 15 min** sin tráfico, con ~1 min de arranque en frío. Si vas
  a demostrar el sistema en vivo, ábrelo un par de minutos antes.
- **750 horas de instancia al mes** por workspace.
- **512 MB de RAM** en el servicio web. El pipeline corre en el mismo proceso, así
  que no aguanta varias búsquedas simultáneas.
- **El Redis gratuito es solo en memoria** y pierde todo al reiniciar. Aquí solo
  cachea `request_id` por 24 h, así que perderlo únicamente causa re-consultas.

## Levantar el proyecto en otra máquina

```bash
git clone https://github.com/ferrsandoval/BDplataforma.git
cd BDPlataforma
cp .env.example backend/.env    # y rellenar con los valores reales
docker compose up --build
```

Los archivos `.env` están en `.gitignore` a propósito y no viajan con el repo.
Sus valores se recuperan del dashboard de cada proveedor (ver tabla de arriba).

Para desarrollar contra los servicios de producción en vez de los contenedores
locales, apunta `backend/.env` a las mismas URLs de Atlas, Neon y Render.
