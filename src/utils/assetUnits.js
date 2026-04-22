/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ENQY TERMINAL — ASSET UNIT LIBRARY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Setiap kelas aset memiliki sistem satuan yang berbeda:
 *
 * STOCK    → IDX (.JK): LOT (1 lot = 100 lembar) | US/Global: SHARE
 * CRYPTO   → Satuan coin itu sendiri (BTC, ETH, SOL, dsb.) — bisa desimal
 * FOREX    → Pasangan mata uang, dihitung dalam LOTS standar forex
 *             1 Standard Lot = 100,000 unit base currency
 *             1 Mini Lot     =  10,000 unit base currency
 *             1 Micro Lot    =   1,000 unit base currency
 * COMMODITY → Tiap komoditi punya satuan sendiri:
 *             Emas, Perak    → Troy Ounce (oz t) atau Gram
 *             Minyak Mentah  → Barrel
 *             Gas Alam       → MMBtu
 *             Umum           → UNIT
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─── COMMODITY UNIT MAP ──────────────────────────────────────────────────────
const COMMODITY_UNIT_MAP = [
  // GOLD
  { match: ['GC=F', 'XAUUSD=X', 'GOLD', 'XAU'], unit: 'oz t', unitFull: 'Troy Ounce', multiplier: 1, canConvertGram: true, gramsPerUnit: 31.1035 },
  // SILVER
  { match: ['SI=F', 'XAGUSD=X', 'SILVER', 'XAG'], unit: 'oz t', unitFull: 'Troy Ounce', multiplier: 1, canConvertGram: true, gramsPerUnit: 31.1035 },
  // CRUDE OIL WTI
  { match: ['CL=F', 'WTI', 'CRUD'], unit: 'bbl', unitFull: 'Barrel', multiplier: 1 },
  // BRENT CRUDE
  { match: ['BZ=F', 'BRENT'], unit: 'bbl', unitFull: 'Barrel', multiplier: 1 },
  // NATURAL GAS
  { match: ['NG=F', 'NGAS'], unit: 'MMBtu', unitFull: 'Million BTU', multiplier: 1 },
  // COPPER
  { match: ['HG=F', 'COPPER'], unit: 'lbs', unitFull: 'Pounds', multiplier: 1 },
  // PLATINUM
  { match: ['PL=F', 'PLAT'], unit: 'oz t', unitFull: 'Troy Ounce', multiplier: 1, canConvertGram: true, gramsPerUnit: 31.1035 },
  // PALLADIUM
  { match: ['PA=F', 'PALL'], unit: 'oz t', unitFull: 'Troy Ounce', multiplier: 1, canConvertGram: true, gramsPerUnit: 31.1035 },
  // COAL
  { match: ['MTF=F', 'COAL', 'KCBT'], unit: 'ton', unitFull: 'Metric Ton', multiplier: 1 },
  // CPO / PALM OIL
  { match: ['CPO', 'PALM', 'FCPO'], unit: 'ton', unitFull: 'Metric Ton', multiplier: 1 },
  // RUBBER
  { match: ['RUBBER', 'SICOM'], unit: 'kg', unitFull: 'Kilogram', multiplier: 1 },
  // CORN / SOYBEANS / WHEAT
  { match: ['ZC=F', 'CORN', 'ZS=F', 'SOY', 'ZW=F', 'WHEAT'], unit: 'bu', unitFull: 'Bushel', multiplier: 1 },
];

// ─── FOREX LOT MAP ───────────────────────────────────────────────────────────
const FOREX_LOT_TYPES = [
  { id: 'STANDARD', label: 'Standard Lot', units: 100000 },
  { id: 'MINI',     label: 'Mini Lot',     units: 10000  },
  { id: 'MICRO',    label: 'Micro Lot',    units: 1000   },
  { id: 'NANO',     label: 'Nano Lot',     units: 100    },
];

// ─── CRYPTO UNIT RESOLVER ────────────────────────────────────────────────────
/**
 * Ambil nama coin dari simbol crypto
 * e.g. 'BTC-USD' → 'BTC' | 'ETH-USD' → 'ETH'
 */
const getCryptoCoinName = (symbol) => {
  if (!symbol) return 'COIN';
  const s = String(symbol).toUpperCase();
  // Format: COIN-USD, COIN-USDT, COIN-EUR
  const dashIdx = s.indexOf('-');
  if (dashIdx !== -1) return s.substring(0, dashIdx);
  // Format: COINUSDT (Binance style)
  const stables = ['USDT', 'USDC', 'BUSD', 'USD', 'EUR'];
  for (const stable of stables) {
    if (s.endsWith(stable)) return s.substring(0, s.length - stable.length);
  }
  return s;
};

// ─── COMMODITY RESOLVER ──────────────────────────────────────────────────────
/**
 * Cari definisi unit untuk komoditi berdasarkan simbol
 */
const getCommodityUnit = (symbol) => {
  const s = String(symbol).toUpperCase();
  for (const def of COMMODITY_UNIT_MAP) {
    if (def.match.some(m => s.includes(m))) return def;
  }
  // Default untuk komoditi yang tidak dikenali
  return { unit: 'UNIT', unitFull: 'Unit', multiplier: 1 };
};

// ─── MAIN: getAssetUnitDef ────────────────────────────────────────────────────
/**
 * Kembalikan definisi satuan lengkap untuk suatu aset.
 *
 * @param {string} symbol   - Simbol aset (e.g. 'BBCA.JK', 'BTC-USD', 'GC=F', 'EURUSD=X')
 * @param {string} assetType - Tipe aset: 'STOCK' | 'CRYPTO' | 'FOREX' | 'COMMODITY'
 * @param {object} options  - Opsi tambahan: { forexLotType: 'STANDARD'|'MINI'|'MICRO'|'NANO' }
 *
 * @returns {object} {
 *   unit:        string  - Satuan singkat (e.g. 'lot', 'BTC', 'oz t', 'bbl')
 *   unitFull:    string  - Nama lengkap satuan (e.g. 'IDX Lot (100 lembar)', 'Troy Ounce')
 *   multiplier:  number  - Faktor pengali untuk nilai (lot → lembar, forex lot → base units)
 *   decimals:    number  - Jumlah desimal yang dianjurkan untuk input
 *   hint:        string  - Teks hint untuk form input
 *   lotSize:     number  - Alias untuk multiplier (kompatibilitas dengan kode lama)
 *   isLot:       boolean - True jika satuan ini adalah konsep LOT (butuh konversi)
 *   canConvertGram: boolean - True hanya untuk emas/perak
 *   gramsPerUnit: number  - Gram per troy ounce (31.1035) jika berlaku
 * }
 */
export function getAssetUnitDef(symbol, assetType, options = {}) {
  const type = String(assetType).toUpperCase();
  const sym  = String(symbol || '').toUpperCase();

  // ── STOCK ────────────────────────────────────────────────────────────────
  if (type === 'STOCK') {
    if (sym.endsWith('.JK')) {
      return {
        unit:        'lot',
        unitFull:    'IDX Lot (100 lembar)',
        multiplier:  100,
        lotSize:     100,
        decimals:    0,
        isLot:       true,
        hint:        '1 lot = 100 lembar saham. Masukkan jumlah lot.',
        canConvertGram: false,
      };
    }
    // US / Global stocks — no lot concept
    return {
      unit:        'share',
      unitFull:    'Shares',
      multiplier:  1,
      lotSize:     1,
      decimals:    0,
      isLot:       false,
      hint:        'Masukkan jumlah lembar saham (shares).',
      canConvertGram: false,
    };
  }

  // ── CRYPTO ───────────────────────────────────────────────────────────────
  if (type === 'CRYPTO') {
    const coinName = getCryptoCoinName(sym);
    return {
      unit:        coinName,
      unitFull:    `${coinName} Coin/Token`,
      multiplier:  1,
      lotSize:     1,
      decimals:    18, // High precision for crypto (standard EVM decimals)
      isLot:       false,
      hint:        `Masukkan jumlah ${coinName}. Mendukung hingga 18 angka di belakang koma.`,
      canConvertGram: false,
    };
  }

  // ── FOREX ────────────────────────────────────────────────────────────────
  if (type === 'FOREX') {
    // Extract base currency dari pair (e.g. 'EURUSD=X' → 'EUR')
    const baseCur = sym.replace('=X', '').length >= 6 ? sym.replace('=X', '').substring(0, 3) : sym.replace('=X', '');
    const quoteCur = sym.replace('=X', '').length >= 6 ? sym.replace('=X', '').substring(3, 6) : '';

    // Tentukan lot type dari options (default: MICRO for accessibility)
    const lotTypeId = options.forexLotType || 'MICRO';
    const lotDef = FOREX_LOT_TYPES.find(l => l.id === lotTypeId) || FOREX_LOT_TYPES[2];

    return {
      unit:        'lot',
      unitFull:    `${lotDef.label} (${lotDef.units.toLocaleString()} ${baseCur})`,
      multiplier:  lotDef.units, // 1 lot = N unit base currency
      lotSize:     lotDef.units,
      decimals:    2,
      isLot:       true,
      baseCurrency: baseCur,
      quoteCurrency: quoteCur,
      lotTypes:    FOREX_LOT_TYPES,
      selectedLotType: lotTypeId,
      hint:        `Forex Lot. 1 ${lotDef.label} = ${lotDef.units.toLocaleString()} ${baseCur}. Leverage tidak dihitung.`,
      canConvertGram: false,
    };
  }

  // ── COMMODITY ────────────────────────────────────────────────────────────
  if (type === 'COMMODITY') {
    const commodDef = getCommodityUnit(sym);
    return {
      unit:        commodDef.unit,
      unitFull:    commodDef.unitFull,
      multiplier:  commodDef.multiplier || 1,
      lotSize:     commodDef.multiplier || 1,
      decimals:    3,
      isLot:       false,
      hint:        `Masukkan jumlah dalam ${commodDef.unitFull} (${commodDef.unit}).`,
      canConvertGram: commodDef.canConvertGram || false,
      gramsPerUnit: commodDef.gramsPerUnit || null,
    };
  }

  // ── FALLBACK ─────────────────────────────────────────────────────────────
  return {
    unit:        'unit',
    unitFull:    'Unit',
    multiplier:  1,
    lotSize:     1,
    decimals:    4,
    isLot:       false,
    hint:        'Masukkan jumlah unit.',
    canConvertGram: false,
  };
}

/**
 * Format tampilan satuan untuk label di tabel/form
 * e.g. (5, 'lot') → '5 lot' | (0.25, 'BTC') → '0.25 BTC'
 */
export function formatQuantity(qty, unitDef) {
  if (qty == null || isNaN(qty)) return '—';
  const dec = unitDef.decimals > 4 ? 8 : (unitDef.decimals > 0 ? unitDef.decimals : 0);
  const num = Number(qty);
  // Untuk crypto dengan nilai kecil sekali
  if (unitDef.decimals >= 8 && num < 0.001 && num > 0) {
    return `${num.toFixed(8)} ${unitDef.unit}`;
  }
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: dec < 4 ? dec : 4 })} ${unitDef.unit}`;
}

/**
 * Hitung total unit aktual dari qty dengan satuan
 * e.g. qty=5 lot IDX → 500 lembar
 */
export function getTotalUnits(qty, unitDef) {
  return (Number(qty) || 0) * (unitDef.multiplier || 1);
}

/**
 * Konversi berat untuk precious metals (troy oz → gram)
 */
export function convertToGrams(qty, unitDef) {
  if (!unitDef.canConvertGram || !unitDef.gramsPerUnit) return null;
  return (Number(qty) || 0) * unitDef.gramsPerUnit;
}

/**
 * Kembalikan semua tipe lot forex untuk dijadikan pilihan di UI
 */
export { FOREX_LOT_TYPES };
