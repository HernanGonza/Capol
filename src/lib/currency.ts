// Conversión de divisas: los cursos se cargan en USD; acá los convertimos a
// la moneda del visitante para mostrarlos. Dos servicios externos gratuitos,
// sin API key:
//  - ipwho.is: geolocalización por IP -> código de país (no da moneda directo)
//  - open.er-api.com: tasas de cambio con base USD, actualizadas ~diario
// Ambos resultados se cachean en localStorage para no golpear las APIs en
// cada carga de página.

const RATES_CACHE_KEY = "capol_exchange_rates_v1";
const RATES_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const GEO_CACHE_KEY = "capol_user_currency_v1";
// v2: el objeto cacheado ahora también incluye "ip" — se cambia la clave
// para que los navegadores que ya tenían el v1 guardado (sin ese campo) no
// lo reusen durante 24hs y se queden sin IP hasta que expire solo.
const GEO_COUNTRY_CACHE_KEY = "capol_user_country_v2";
const GEO_TTL_MS = 24 * 60 * 60 * 1000; // 1 día (la ubicación no cambia seguido)

// Cotización fija para el precio automático que ve un visitante de
// Argentina (landing, catálogo de cursos): a propósito NO es la cotización
// de mercado en vivo — así el precio en pesos no cambia todos los días. El
// conversor de divisas manual (CurrencyConverter, uso administrativo) sigue
// usando la tasa real vía getExchangeRates() para cualquier otro país.
export const ARS_FIXED_RATE = 1500;

// Código de país (ISO 3166-1 alpha-2) -> moneda (ISO 4217). Cubre los
// países más habituales entre los alumnos de la academia; lo que no está
// mapeado cae a USD.
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  AR: "ARS", BO: "BOB", BR: "BRL", CL: "CLP", CO: "COP", CR: "CRC",
  CU: "CUP", DO: "DOP", EC: "USD", SV: "USD", GT: "GTQ", HN: "HNL",
  MX: "MXN", NI: "NIO", PA: "USD", PY: "PYG", PE: "PEN", PR: "USD",
  UY: "UYU", VE: "VES", US: "USD", CA: "CAD",
  ES: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", PT: "EUR", NL: "EUR",
  BE: "EUR", AT: "EUR", IE: "EUR", GR: "EUR", FI: "EUR",
  GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
  RU: "RUB", TR: "TRY", IN: "INR", CN: "CNY", JP: "JPY", KR: "KRW",
  AU: "AUD", NZ: "NZD", ZA: "ZAR",
};

interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number;
}

const readCache = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeCache = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage puede fallar (modo privado, cuota llena, etc.) — no es crítico, seguimos sin cachear.
  }
};

// Tasas de cambio con base USD (1 USD = rates[MONEDA] unidades de esa moneda).
export async function getExchangeRates(): Promise<Record<string, number> | null> {
  const cached = readCache<CachedRates>(RATES_CACHE_KEY);
  if (cached && Date.now() - cached.fetchedAt < RATES_TTL_MS) return cached.rates;

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) throw new Error("No se pudo obtener la cotización");
    const data = await res.json();
    if (data.result !== "success" || !data.rates) throw new Error("Respuesta inválida de la API de cotización");
    writeCache(RATES_CACHE_KEY, { rates: data.rates, fetchedAt: Date.now() });
    return data.rates as Record<string, number>;
  } catch {
    // Si falla y hay algo viejo cacheado, mejor usar eso que nada.
    return cached?.rates || null;
  }
}

// Moneda del visitante según su IP. Devuelve null si no se pudo determinar
// (en ese caso, mostrar USD).
export async function detectUserCurrency(): Promise<string | null> {
  const cached = readCache<{ currency: string | null; fetchedAt: number }>(GEO_CACHE_KEY);
  if (cached && Date.now() - cached.fetchedAt < GEO_TTL_MS) return cached.currency;

  try {
    const res = await fetch("https://ipwho.is/");
    if (!res.ok) throw new Error("No se pudo geolocalizar");
    const data = await res.json();
    if (!data.success || !data.country_code) throw new Error("Respuesta inválida de geolocalización");
    const currency = COUNTRY_TO_CURRENCY[data.country_code] || null;
    writeCache(GEO_CACHE_KEY, { currency, fetchedAt: Date.now() });
    return currency;
  } catch {
    return cached?.currency ?? null;
  }
}

// País (y de paso, IP) del visitante según ipwho.is — lo único que le
// importa al precio automático es si es "AR" o no. Comparte una sola
// entrada de caché entre detectCountryCode() y detectVisitorIp() para no
// duplicar la llamada a la API (el plan gratuito de ipwho.is tiene límite).
interface GeoCacheEntry {
  countryCode: string | null;
  ip: string | null;
  fetchedAt: number;
}

async function fetchGeoInfo(): Promise<GeoCacheEntry> {
  const cached = readCache<GeoCacheEntry>(GEO_COUNTRY_CACHE_KEY);
  if (cached && Date.now() - cached.fetchedAt < GEO_TTL_MS) return cached;

  try {
    const res = await fetch("https://ipwho.is/");
    if (!res.ok) throw new Error("No se pudo geolocalizar");
    const data = await res.json();
    if (!data.success || !data.country_code) throw new Error("Respuesta inválida de geolocalización");
    const entry: GeoCacheEntry = { countryCode: data.country_code, ip: data.ip || null, fetchedAt: Date.now() };
    writeCache(GEO_COUNTRY_CACHE_KEY, entry);
    return entry;
  } catch {
    return cached ?? { countryCode: null, ip: null, fetchedAt: 0 };
  }
}

export async function detectCountryCode(): Promise<string | null> {
  return (await fetchGeoInfo()).countryCode;
}

// IP pública del visitante — se usa solo para el monitoreo de seguridad
// (detectar ráfagas de visitas/registros desde el mismo origen), nunca
// para identificar a una persona en particular.
export async function detectVisitorIp(): Promise<string | null> {
  return (await fetchGeoInfo()).ip;
}

export const convertUsdToCurrency = (
  amountUsd: number,
  currency: string,
  rates: Record<string, number> | null
): number => {
  if (!rates || currency === "USD") return amountUsd;
  const rate = rates[currency];
  return rate ? amountUsd * rate : amountUsd;
};

export const convertCurrencyToUsd = (
  amount: number,
  currency: string,
  rates: Record<string, number> | null
): number => {
  if (!rates || currency === "USD") return amount;
  const rate = rates[currency];
  return rate ? amount / rate : amount;
};

export const formatMoney = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  } catch {
    // Por si Intl no reconoce el código de moneda (no debería pasar con ISO 4217 válidos)
    return `${currency} ${Math.round(amount).toLocaleString("es-AR")}`;
  }
};

export const COUNTRY_NAMES: Record<string, string> = {
  AR: "Argentina", BO: "Bolivia", BR: "Brasil", CL: "Chile", CO: "Colombia",
  CR: "Costa Rica", CU: "Cuba", DO: "República Dominicana", EC: "Ecuador",
  SV: "El Salvador", GT: "Guatemala", HN: "Honduras", MX: "México",
  NI: "Nicaragua", PA: "Panamá", PY: "Paraguay", PE: "Perú",
  PR: "Puerto Rico", UY: "Uruguay", VE: "Venezuela", US: "Estados Unidos",
  CA: "Canadá", ES: "España", DE: "Alemania", FR: "Francia", IT: "Italia",
  PT: "Portugal", NL: "Países Bajos", BE: "Bélgica", AT: "Austria",
  IE: "Irlanda", GR: "Grecia", FI: "Finlandia", GB: "Reino Unido",
  CH: "Suiza", SE: "Suecia", NO: "Noruega", DK: "Dinamarca", PL: "Polonia",
  RU: "Rusia", TR: "Turquía", IN: "India", CN: "China", JP: "Japón",
  KR: "Corea del Sur", AU: "Australia", NZ: "Nueva Zelanda", ZA: "Sudáfrica",
};
