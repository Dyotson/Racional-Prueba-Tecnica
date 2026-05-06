# Investment API

API de inversión construida con **Django 5 + django-ninja 1.3 + PostgreSQL 16**, dockerizada y con integración a **yfinance** (con cache) para precios de acciones en tiempo real.

Permite a un usuario:

1. Registrar depósitos y retiros de efectivo.
2. Operar (comprar/vender) acciones.
3. Editar información personal.
4. Editar la información de su portafolio.
5. Consultar el valor total del portafolio (efectivo + posiciones a precio de mercado).
6. Consultar los últimos movimientos (movimientos de efectivo + órdenes en una sola línea de tiempo).

---

## Tabla de contenidos

- [Cómo correr](#cómo-correr)
- [Modelo de datos](#modelo-de-datos)
- [Justificación de decisiones](#justificación-de-decisiones)
- [Rutas de la API](#rutas-de-la-api)
- [Ejemplos end-to-end con curl](#ejemplos-end-to-end-con-curl)
- [Tests](#tests)
- [Out of scope](#out-of-scope)
- [Uso de IA](#uso-de-ia)

---

## Cómo correr

### Con Docker (recomendado)

```bash
cp .env.example .env
docker compose up --build
```

Esto levanta dos servicios:

- `db` -> PostgreSQL 16 (puerto `5432`).
- `web` -> la API (puerto `8000`). En el arranque corre `migrate` y `seed_stocks` (carga 10 tickers populares: AAPL, MSFT, GOOGL, AMZN, META, TSLA, NVDA, NFLX, KO, JPM).

La API queda disponible en:

- Endpoints: `http://localhost:8000/api/...`
- OpenAPI/Swagger: `http://localhost:8000/api/docs`

### Localmente (sin Docker)

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt

# Apuntar a una Postgres local (o sqlite para pruebas rápidas)
export DATABASE_URL="postgres://user:pass@localhost:5432/investment"
export SECRET_KEY="dev"

.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_stocks
.venv/bin/python manage.py runserver
```

### Variables de entorno

| Variable                  | Default                    | Descripción                                            |
| ------------------------- | -------------------------- | ------------------------------------------------------ |
| `DEBUG`                   | `False`                    | Modo debug de Django.                                  |
| `SECRET_KEY`              | -                          | Obligatoria en producción.                             |
| `ALLOWED_HOSTS`           | `*`                        | Hosts permitidos.                                      |
| `DATABASE_URL`            | `postgres://...investment` | URL de conexión a Postgres (formato `django-environ`). |
| `STOCK_PRICE_TTL_SECONDS` | `300`                      | TTL del cache de precios.                              |

---

## Modelo de datos

```mermaid
erDiagram
    User ||--o| Portfolio : owns
    User ||--o{ AuthToken : has
    Portfolio ||--o{ CashTransaction : records
    Portfolio ||--o{ Order : places
    Stock ||--o{ Order : referenced_by
    User {
        uuid id PK
        string email UK
        string first_name
        string last_name
        string document_id
        string phone
        datetime created_at
    }
    Portfolio {
        uuid id PK
        uuid user_id FK
        string name
        string description
        decimal cash_balance
        datetime created_at
        datetime updated_at
    }
    Stock {
        string symbol PK
        string name
        string currency
        decimal last_price
        datetime last_price_at
    }
    CashTransaction {
        uuid id PK
        uuid portfolio_id FK
        string kind "DEPOSIT|WITHDRAWAL"
        decimal amount
        date transaction_date
        datetime created_at
    }
    Order {
        uuid id PK
        uuid portfolio_id FK
        string symbol FK
        string side "BUY|SELL"
        decimal quantity
        decimal price
        datetime executed_at
        datetime created_at
    }
```

### Tablas

- `**User**`: usuario custom (email-as-username, UUID PK). Hereda de `AbstractBaseUser`.
- `**AuthToken**`: bearer token opaco (URL-safe, ~256 bits). Un usuario puede tener varios (un dispositivo, varios devices).
- `**Portfolio**`: 1:1 con `User`. Se crea automáticamente en un `post_save` signal (ver `[apps/users/signals.py](apps/users/signals.py)`).
- `**Stock**`: catálogo de tickers con cache de precio (`last_price`, `last_price_at`).
- `**CashTransaction**`: ledger append-only de depósitos y retiros.
- `**Order**`: ledger append-only de compras y ventas con snapshot del precio al ejecutar.

---

## Justificación de decisiones

### Por qué `Decimal(18, 4)` para dinero

`float` introduce errores de redondeo binario inaceptables para saldos contables. `Decimal(18, 4)` da headroom para trillones con precisión de cuatro decimales (suficiente para cualquier moneda de mercado).

### Por qué `Portfolio` 1:1 con `User`

El enunciado habla de _“el portafolio del usuario”_ (singular). Modelarlo 1:1 hace más simple el resto del código: el endpoint `/api/me/portfolio/total` no necesita seleccionar un portafolio, y los servicios no tienen que preocuparse por qué portafolio mutar. Si más adelante se quisieran múltiples portafolios por usuario, basta con cambiar el `OneToOneField` por `ForeignKey` y agregar el portfolio al request.

### Por qué `cash_balance` denormalizado en `Portfolio`

Se actualiza dentro de la misma `transaction.atomic()` que crea la fila del ledger, y el `select_for_update` sobre el portafolio garantiza que dos depósitos/órdenes concurrentes se serialicen. La alternativa (recalcular el saldo a partir del ledger en cada lectura) sería O(N) por consulta y nos obligaría a mantener un índice por tabla y por usuario; denormalizar es la elección estándar para sistemas contables siempre que las mutaciones queden encerradas en transacciones.

### Por qué los `Holdings` se calculan, no se almacenan

Para evitar drift (una tabla `Holding` que se desincroniza del ledger). La posición por símbolo se deriva en SQL con dos `Sum(filter=Q(side=BUY))` y `Sum(filter=Q(side=SELL))` agrupando por símbolo (ver `[apps/portfolios/services.py](apps/portfolios/services.py)`). El costo promedio se computa con la fórmula clásica: `sum(buy_qty * buy_price) / sum(buy_qty)` (las ventas reducen quantity pero no el costo promedio). Si en el futuro la cardinalidad lo amerita, se puede materializar como vista o tabla con triggers, sin cambiar la API pública.

### Por qué `Order.symbol` es `CharField` y no `ForeignKey(Stock)`

Las filas del ledger son inmutables y deben sobrevivir aunque un ticker se elimine del catálogo. Renunciamos a la integridad referencial estricta a cambio de inmutabilidad histórica, que es más importante en un audit trail.

### Cache de precios en `Stock`

Se usa el propio modelo como cache (sin Redis). Una sola fila por símbolo con TTL configurable (default 5 minutos). El servicio `[apps/stocks/services.py](apps/stocks/services.py)` decide cache-vs-fetch:

- Si está fresco -> devuelve la fila.
- Si expiró -> intenta yfinance; si funciona, persiste y devuelve fresco.
- Si yfinance falla -> devuelve el último precio conocido con `is_stale=True`.

Esto mantiene la API responsive cuando la dependencia externa está flaky, y deja al cliente decidir cómo mostrarlo. Por otra parte, se descarto la utilización de redis o sistemas basados en WebSockets/Async, debido a que no se penso como un API para "live trading", sino más para el "investment portfolio" type user.

### Stocks definidos por plataforma (¿Por qué no habilitar la compra de cualquier stock?)

Se decidio dar una lista pequeña de stocks que un usuario puede comprar, esto es para simplificar el sistema y para imitar como funcionan la mayoria de los brokers de acciones (Puedes comprar ciertas acciones o ciertas bolsas, pero no todo esta disponible). Por otra parte, permite ejecutar desde el principio la conexión y actualización de precios con yfinance.

### Snapshot del precio en `Order.price`

Imprescindible para auditoría y para reconstruir el costo promedio sin depender de precios futuros que podrían haber cambiado.

### Concurrencia

Cada operación que muta saldo (`deposit`, `withdraw`, `place_buy`, `place_sell`) usa `transaction.atomic()` + `select_for_update()` sobre el portafolio. Dos retiros simultáneos del mismo usuario nunca pueden cruzar la validación `cash_balance >= amount` y dejar saldo negativo.

### Validaciones en services, no en views

Los routers de django-ninja sólo deserializan input, llaman al servicio y serializan output. Toda regla de negocio (fondos suficientes, holding suficiente, símbolo en catálogo) vive en `services.py` y se comunica al cliente via `BusinessRuleError` -> 422 con `code` estable (ver `[apps/core/exceptions.py](apps/core/exceptions.py)`).

---

## Rutas de la API

| Método | Ruta                         | Auth | Body / Query                                      | Respuesta                                                                   |
| ------ | ---------------------------- | ---- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| POST   | `/api/auth/register`         | -    | `{email, password, first_name?, last_name?, ...}` | 201 `{token, user_id, email}`                                               |
| POST   | `/api/auth/login`            | -    | `{email, password}`                               | 200 `{token, user_id, email}`                                               |
| POST   | `/api/auth/logout`           | yes  | -                                                 | 204                                                                         |
| GET    | `/api/me`                    | yes  | -                                                 | 200 `User`                                                                  |
| PATCH  | `/api/me`                    | yes  | `{first_name?, last_name?, document_id?, phone?}` | 200 `User`                                                                  |
| GET    | `/api/me/portfolio`          | yes  | -                                                 | 200 `Portfolio`                                                             |
| PATCH  | `/api/me/portfolio`          | yes  | `{name?, description?}`                           | 200 `Portfolio`                                                             |
| GET    | `/api/me/portfolio/total`    | yes  | -                                                 | 200 `{cash_balance, holdings_value, total_value, holdings[], prices_stale}` |
| POST   | `/api/transactions/deposit`  | yes  | `{amount, transaction_date}`                      | 201 `CashTransaction`                                                       |
| POST   | `/api/transactions/withdraw` | yes  | `{amount, transaction_date}`                      | 201 `CashTransaction`                                                       |
| POST   | `/api/orders/buy`            | yes  | `{symbol, quantity}`                              | 201 `Order`                                                                 |
| POST   | `/api/orders/sell`           | yes  | `{symbol, quantity}`                              | 201 `Order`                                                                 |
| GET    | `/api/me/movements`          | yes  | `?limit=20&offset=0`                              | 200 `{items[], limit, offset, total}`                                       |
| GET    | `/api/stocks/available`      | -    | -                                                 | 200 `{stocks[]}`                                                            |
| GET    | `/api/stocks/{symbol}`       | -    | -                                                 | 200 `{symbol, name, currency, price, price_at, is_stale}`                   |

Auth: header `Authorization: Bearer <token>`.

OpenAPI completa autogenerada en `http://localhost:8000/api/docs`. (Gracias a que django-ninja viene con Swagger automatico)

### Errores

Errores de negocio devuelven HTTP 4xx con shape estable:

```json
{
  "detail": "Cash balance 50.0000 is below requested amount 200.",
  "code": "insufficient_funds"
}
```

Codes definidos: `insufficient_funds`, `insufficient_holdings`, `stock_not_available`, `invalid_credentials`, `email_already_taken`, `weak_password`, `validation_error`, `business_rule_error`.

---

## Ejemplos end-to-end con curl

```bash
BASE=http://localhost:8000/api

# 1. Registro
TOKEN=$(curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"StrongPass!1234","first_name":"Alice"}' \
  | python -c "import sys, json; print(json.load(sys.stdin)['token'])")

AUTH="Authorization: Bearer $TOKEN"

# 2. Editar info personal
curl -s -X PATCH $BASE/me \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"phone":"+5491100000000"}'

# 3. Editar info del portafolio
curl -s -X PATCH $BASE/me/portfolio \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"name":"Aggressive","description":"High beta tech basket"}'

# 4. Depósito
curl -s -X POST $BASE/transactions/deposit \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"amount":"5000","transaction_date":"2025-01-15"}'

# 5. Compra
curl -s -X POST $BASE/orders/buy \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","quantity":"10"}'

# 6. Total del portafolio
curl -s $BASE/me/portfolio/total -H "$AUTH"

# 7. Movimientos
curl -s "$BASE/me/movements?limit=10" -H "$AUTH"
```

---

## Tests

```bash
DATABASE_URL=sqlite:///test.db SECRET_KEY=test .venv/bin/pytest tests/
```

Cubre:

- Reglas de negocio críticas (depósito incrementa saldo, retiro insuficiente falla, compra sin fondos falla, venta sin holding falla, símbolo desconocido).
- Cálculo de total del portafolio con múltiples holdings.
- Cálculo de costo promedio con compra+venta parcial.
- Flujo end-to-end por HTTP: register → me → portfolio → deposit → buy → total → movements.
- Auth: requests sin token devuelven 401.

El provider de yfinance se mockea globalmente en `[tests/conftest.py](tests/conftest.py)` para que los tests sean deterministas y offline.

---

## Out of scope

Decisiones explícitamente _no_ implementadas para mantener el alcance del desafío:

- Multi-currency / FX.
- Histórico de valuación del portafolio (snapshots diarios).
- Comisiones, impuestos, market orders vs limit orders, fracciones de acción.
- Refresh tokens, OAuth, MFA.
- Rate limiting, observabilidad (Prometheus/OTLP), audit log explícito.
- Workers asíncronos (Celery) para refrescar precios proactivamente.

---

## Uso de IA

Se utilizaron modelos LLM para el desarrollo de esta prueba técnica. Los modelos fueron utilizados por medio del IDE 'Cursor', donde mi flujo de trabajo consistio en lo siguiente:

1. Desarrollo un scaffold del endpoint (Que quiero que haga, como quiero que lo haga y donde quiero que lo haga)
2. En caso de que sea un endpoint sencillo (Como retornar un JSON con todas las opciones de stock disponibles), le pido al LLM que lo haga. Si es algo más complicado, hago yo la primera versión (Con type safety y utilizando clean code practices).
3. Cuando termino la primera versión, le pido al LLM elaborar un test a partir del endpoint y, con el test ya ejecutado, arreglar problemas de logica o runtime que se me hayan escapado.
4. Iterar sobre el test varias veces (Junto al LLM codeando) para llegar a una solución 99% efectiva (No existe el codigo perfecto)
5. Luego, correr el test-suite completo y realizar pruebas de integración manualmente.

Para la descripción de los endpoints y sus ejemplos en el README.md, se utilizo tambien LLMs.
Por ultimo, para el traspaso del diagrama-ER desde Miro a mermaidMD tambien se utilizo LLMs.
