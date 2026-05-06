# Racional Portfolio · Visualización en tiempo real

Dashboard web que se suscribe en vivo al documento de Firestore `investmentEvolutions/user1` y muestra la evolución del portafolio con un gráfico interactivo, métricas de desempeño y un indicador de conexión animado.

UI inspirada en **Fintual**, **Coinbase** y **TradingView**, con un foco explícito en **lenguaje cotidiano**: un usuario que recién empieza a invertir debería entender la pantalla sin googlear ningún término. Por eso usamos "Tus inversiones valen", "Has puesto" y "% de retorno" en vez de "valor liquidativo", "aportes acumulados" y "TWR (time-weighted return)".

---

## Tabla de Contenidos

- [Cómo ejecutarlo](#cómo-ejecutarlo)
- [Stack y por qué](#stack-y-por-qué)
- [Arquitectura](#arquitectura)
- [Esquema real del documento](#esquema-real-del-documento)
- [Decisiones de UX](#decisiones-de-ux)
- [Créditos visuales](#créditos-visuales)
- [Uso de IA](#uso-de-ia)

---

## Cómo ejecutarlo

Requisitos: Node.js 18+ y npm.

```bash
cd racional-portfolio
npm install
npm run dev
```

La aplicación quedará disponible en `http://localhost:5173`. La configuración de Firebase entregada por el enunciado viene precargada en [`src/lib/firebase.ts`](src/lib/firebase.ts), por lo que no es necesario crear un archivo `.env` para ejecutar el proyecto.

Si igualmente se quiere apuntar a otro proyecto de Firebase (por ejemplo para testing), basta con copiar `.env.example` a `.env` y completar las variables `VITE_FIREBASE_*`. Cualquier valor faltante cae al config por defecto del enunciado.

Otros comandos útiles:

```bash
npm run build      # Type-check + bundle de producción en dist/
npm run preview    # Sirve el build de producción
npm run lint       # Reservado por si se agrega ESLint en el futuro
```

---

## Stack y por qué

| Decisión                         | Justificación                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vite + React 18 + TypeScript** | Arranque instantáneo, HMR rápido y tipado estricto, indispensable en un dominio financiero donde un `undefined` mal manejado puede mostrar valores incorrectos. |
| **Firebase v10 (modular SDK)**   | API tree-shakeable y `onSnapshot` listo para suscripciones en tiempo real; reduce el bundle frente al SDK monolítico.                                           |
| **Recharts**                     | Equilibrio entre una API React-idiomática y resultado estético; permite tooltip y crosshair custom sin pelearse con D3.                                         |
| **Tailwind CSS**                 | Permite iterar la UI rápido manteniendo un sistema de diseño coherente (tokens de color, espaciados, animaciones) sin CSS huérfano.                             |
| **lucide-react**                 | Iconografía consistente y ligera, importada por componente.                                                                                                     |
| **date-fns** + locale `es`       | Formateo de fechas y "hace X segundos" en español, sin Moment ni ICU completo.                                                                                  |
| **clsx**                         | Combinación condicional de clases sin templating frágil.                                                                                                        |

Bundle dividido manualmente en `react`, `firebase` y `recharts` para que el chunk principal sea pequeño y los más pesados se carguen en paralelo (ver [`vite.config.ts`](vite.config.ts)).

---

## Arquitectura

```
src/
  lib/
    firebase.ts                # init de Firebase + ruta del documento
    types.ts                   # PortfolioPoint, Holding, ConnectionStatus, RangeKey
    normalize.ts               # normalizador defensivo (ver más abajo)
    formatters.ts              # plata, %, fechas, "hace X segundos"
    stats.ts                   # filtro por rango, retorno total, drawdown, etc.
  hooks/
    useInvestmentEvolution.ts  # onSnapshot -> { portfolio, status, lastUpdated, error }
    useAnimatedNumber.ts       # tween con requestAnimationFrame respetando reduce-motion
  components/
    Header.tsx
    LiveIndicator.tsx
    PortfolioSummary.tsx       # hero animado + sparkline
    RangeSelector.tsx
    PortfolioChart.tsx         # AreaChart + tooltip + crosshair + reference dots
    StatsGrid.tsx
    HoldingsTable.tsx          # solo si el documento entrega posiciones
    SkeletonChart.tsx / EmptyState.tsx / ErrorState.tsx
  App.tsx                      # composición + estado del rango
  main.tsx
  index.css                    # Tailwind + tokens + animaciones
```

Flujo de datos:

```
Firestore (investmentEvolutions/user1)
        │ onSnapshot
        ▼
useInvestmentEvolution  ──►  status, lastUpdated, error
        │
        ▼
normalizePortfolio  ──►  PortfolioPoint[], Holding[], currency
        │
        ▼
filterByRange (RangeSelector)
        │
        ├─►  PortfolioSummary (hero + delta + sparkline)
        ├─►  PortfolioChart   (área + tooltip + reference)
        ├─►  StatsGrid        (retorno, drawdown, mejor/peor día)
        └─►  HoldingsTable    (solo si hay holdings)
```

---

## Esquema real del documento

Conectado contra el proyecto del enunciado, el documento `investmentEvolutions/user1`
contiene entradas con la siguiente forma:

```ts
{
  array: Array<{
    date: { seconds: number; nanoseconds: number }; // Firestore Timestamp
    portfolioValue: number; // valor total del portafolio en ese día
    contributions: number; // aportes acumulados (capital depositado)
    portfolioIndex: number; // índice base 100 = TWR (time-weighted return)
    dailyReturn: number; // retorno diario decimal (0.0123 = +1,23 %)
  }>;
}
```

Esto es importante porque entrega **dos métricas de retorno distintas** y la diferencia es crítica:

- `portfolioValue − contributions` = **ganancia neta** en plata (lo que el usuario realmente ganó por sobre lo que aportó).
- `portfolioIndex` = **TWR** = retorno time-weighted, que neutraliza el efecto de los depósitos y mide la rentabilidad real del portafolio.

Una métrica naive como `(último valor − primer valor) / primer valor` daría **+242 %** sobre la serie completa, lo cual es engañoso: la mayor parte de ese crecimiento son nuevos aportes, no rentabilidad. El TWR real para el mismo rango es **+10,79 %**. La app prioriza siempre el TWR como retorno y muestra
la ganancia neta en plata como contexto.

**IMPORTANTE**: Se hard-codearon las credenciales de firestore debido a que se **encuentran publicas en el internet**, pero cabe recalcar que lo correcto seria guardarlas en un `.local.env`

### Normalizador defensivo

Pese a tener el esquema verificado, [`src/lib/normalize.ts`](src/lib/normalize.ts) sigue siendo tolerante por si el documento cambia en el futuro (Esto para mantener type safety dentro del documento):

- Series bajo `array | history | values | snapshots | data | points | series | evolution | timeline | track`.
- Arreglo en la raíz del documento o mapa con claves de fecha.
- Tuplas `[date, value]` dentro de los arreglos.
- Timestamps de Firestore (`{ seconds, nanoseconds }`), strings ISO, segundos o milisegundos epoch.
- Sinónimos para valor (`portfolioValue | value | amount | total | balance | …`), aportes (`contributions | invested | deposits | …`), índice TWR (`portfolioIndex | index | twr | …`) y retorno diario (`dailyReturn | dailyChange | return | …`).
- Holdings opcionales bajo `holdings | positions | assets | instruments | tickers | stocks`.
- Moneda bajo `currency | ccy | unit` (cae a `USD`).

El primer snapshot recibido se loggea por consola junto al campo donde se encontró la serie, para hacer trivial inspeccionar la forma real durante el code review. Si el documento no contiene una serie reconocible la app muestra `EmptyState` y mantiene la suscripción activa.

---

## Decisiones de UX

- **Lenguaje cotidiano sobre jerga financiera**: el hero dice "Tus inversiones valen" y "Has puesto" en vez de "valor liquidativo" y "aportes acumulados". La tarjeta de TWR se llama "% de retorno" con la coletilla "solo crecimiento" (en vez de "TWR" o "rentabilidad time-weighted"). Los términos técnicos siguen existiendo en los `title` HTML para usuarios curiosos, pero la superficie principal asume cero conocimiento financiero previo.
- **Una sola píldora de ganancia en el hero**: en una iteración previa convivían dos píldoras (ganancia money-weighted vs. TWR), lo que parecía un bug ("¿por qué dos retornos distintos?"). Hoy el hero muestra **una** píldora unificada `↗ +$X · +Y % · {rango}` con la ganancia real en plata; el TWR vive abajo, en la grilla de stats, bajo un nombre distinto ("% de retorno") para que sea evidente que es otro concepto y no la misma cifra dos veces.
- **TWR real, no naive, en la grilla de stats**: la tarjeta "% de retorno" usa `portfolioIndex` (TWR), no `(último − primero) / primero`. Esto evita confundir aportes con ganancias; un usuario que depositó $200 K no debería ver "+200 % de crecimiento este mes". El `title` de la tarjeta explica en una frase qué significa "sin contar tus depósitos".
- **Doble serie en el gráfico**: el área verde es lo que vale el portafolio y la línea punteada gris (`stepAfter`) es lo que has puesto. La diferencia vertical entre ambas líneas en cualquier punto del eje X es exactamente lo que has ganado ese día. Cada "escalón" de la línea punteada es un depósito nuevo, lo que hace obvio cuándo entró capital fresco.
- **`dailyReturn` directo para mejor / peor día**: usar el campo entregado por Firestore evita que un día con depósito se interprete como un alza estratosférica.
- **Mayor caída sobre el índice TWR**: se mide sobre `portfolioIndex`, no sobre `portfolioValue`, para que un retiro o un aporte no resetee el peak artificialmente.
- **Color semántico universal en finanzas**: verde `#16c784` para alzas, rojo `#ea3943` para bajas, alineado con TradingView, Coinbase, Binance y CoinMarketCap.
- **Valor animado**: el monto principal interpola con `requestAnimationFrame` cuando llega un snapshot nuevo, comunicando que está vivo sin distraer.
- **Crosshair + tooltip personalizado**: muestra fecha, valor, aportes, ganancia ($ y %) e índice TWR del punto bajo el cursor, replicando el patrón de TradingView pero con el contexto fintech que el usuario realmente necesita.
- **Reference dots de máximo y mínimo**: identifican el peak y el valle del rango sin necesidad de leer las cifras de la cuadrícula.
- **Selector de rango con disponibilidad real**: los botones de rangos sin datos quedan deshabilitados (`opacity` baja, no clickeables) en vez de mostrar vacíos confusos. Si el rango activo deja de tener datos, se ajusta automáticamente al rango disponible más cercano.
- **Indicador de conexión con cuatro estados**: nunca dejamos al usuario sin saber si los datos que ve son frescos. Pasados 30 s sin updates, el estado cambia a "Sin datos recientes" en vez de mentir con un "En vivo" estático.
- **Skeletons en lugar de spinners**: muestran el layout final, evitando el layout shift al llegar los datos.
- **Tabla de holdings condicional**: si el documento no expone posiciones, simplemente no se renderiza, en vez de mostrar una sección vacía.
- **Accesibilidad**: roles ARIA en el indicador (`status`, `aria-live`) y el selector (`radiogroup` / `radio` con `aria-checked`), íconos decorativos con `aria-hidden`, contraste validado contra WCAG AA y respeto a `prefers-reduced-motion` (las animaciones se desactivan globalmente).
- **Responsive mobile-first**: layout que reflowa en una sola columna bajo 768 px y compone en grilla de 4 columnas en desktop.

---

## Créditos visuales

Inspiración: [Fintual](https://fintual.cl/), [Coinbase](https://coinbase.com/),[TradingView](https://tradingview.com/), [Binance](https://binance.com/) y la propia [Racional](https://racional.com/).

Tambien, se scrappeo parte de los datos de Racional para entender mejor ciertas decisiones visuales de logica, utilizando mi repo [RacionalScrapper](https://github.com/Dyotson/RacionalScrapper).

## Uso de IA

Se utilizaron LLMs para:

- Codificar ciertas mejoras visuales (Como mejorar el centrado de diferentes divs)
- Arreglar y mejorar redacción en README.md
- El favicon fue generado con Nano Banana Pro
- Entender mejor ciertas formulas matematicas de mediciones economicas.
