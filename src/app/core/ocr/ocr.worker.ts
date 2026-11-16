/// <reference lib="webworker" />

import { createWorker, PSM } from 'tesseract.js';

interface OcrInput {
  imageData: string; // base64 data URL
  language: string;
}

interface OcrOutput {
  success: boolean;
  data?: OcrParsedResult;
  error?: string;
  confidence: number;
  processingTimeMs: number;
}

export interface OcrParsedResult {
  product_name?: string;
  category?: 'hortifruti' | 'proteina' | 'grao' | 'laticinio' | 'panificado' | 'outro';
  quantity_kg?: number;
  unit?: 'kg' | 'un' | 'l';
  expiration_date?: string; // YYYY-MM-DD
  lot_code?: string;
  barcode?: string;
  rawText: string;
}

const CATEGORIES = ['hortifruti', 'proteina', 'grao', 'laticinio', 'panificado', 'outro'] as const;
const UNITS = ['kg', 'un', 'l'] as const;

// Palavras-chave para extração de campos
const PATTERNS = {
  // Códigos de barras EAN-13, Code-128, etc.
  barcode: /\b(\d{8,14})\b/g,

  // Datas: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  date: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,

  // Quantidades: 5kg, 5.5 kg, 10 un, 2.5l, etc.
  quantity: /\b(\d+[.,]?\d*)\s*(kg|g|un|l|ml)\b/gi,

  // Lote: L123, LOTE 456, LOT 789
  lot: /\b(?:lote|lot|l)\s*[:\-]?\s*([A-Z0-9]{3,20})\b/gi,

  // Validade: VAL 12/2025, VENC 15/10/2025, EXP 2025-12-31
  expiration: /\b(?:val|venc|exp|validade)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/gi,
};

let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

async function initializeWorker(language = 'por'): Promise<void> {
  if (worker) return;

  worker = await createWorker(language, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        self.postMessage({ type: 'progress', progress: Math.round(m.progress * 100) });
      }
    },
    // Configurações para velocidade em mobile
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7/tesseract-core.wasm.js',
    dataPath: 'https://tessdata.projectnaptha.com/4.0.0/',
  });

  // Configurações otimizadas para códigos de barras e notas fiscais
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./-: ',
    preserve_interword_spaces: '1',
  });
}

function parseOcrText(text: string): OcrParsedResult {
  const result: OcrParsedResult = { rawText: text };
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Código de barras (prioridade alta)
  const barcodeMatches = text.match(PATTERNS.barcode);
  if (barcodeMatches) {
    // Pega o mais longo (EAN-13 = 13 dígitos)
    result.barcode = barcodeMatches.reduce((a, b) => a.length >= b.length ? a : b);
  }

  // 2. Data de validade
  const expMatches = [...text.matchAll(PATTERNS.expiration)];
  if (expMatches.length > 0) {
    const dateStr = expMatches[0][1];
    const normalized = normalizeDate(dateStr);
    if (normalized) result.expiration_date = normalized;
  } else {
    // Fallback: procura qualquer data no texto
    const dateMatches = [...text.matchAll(PATTERNS.date)];
    if (dateMatches.length > 0) {
      // Pega a data mais futura (assumindo que é validade)
      const dates = dateMatches.map(m => normalizeDate(m[0])).filter(Boolean) as string[];
      const futureDates = dates.filter(d => {
        const [year, month, day] = d.split('-').map(Number);
        return new Date(year, month - 1, day) > new Date();
      });
      if (futureDates.length > 0) {
        result.expiration_date = futureDates.sort()[0]; // a mais próxima
      }
    }
  }

  // 3. Quantidade + unidade
  const qtyMatches = [...text.matchAll(PATTERNS.quantity)];
  if (qtyMatches.length > 0) {
    const match = qtyMatches[0];
    const value = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();
    if (unit === 'g') {
      result.quantity_kg = value / 1000;
      result.unit = 'kg';
    } else if (unit === 'ml') {
      result.quantity_kg = value / 1000;
      result.unit = 'l';
    } else {
      result.quantity_kg = value;
      result.unit = unit as 'kg' | 'un' | 'l';
    }
  }

  // 4. Código do lote
  const lotMatches = [...text.matchAll(PATTERNS.lot)];
  if (lotMatches.length > 0) {
    result.lot_code = lotMatches[0][1];
  }

  // 5. Nome do produto (heurística: linha mais longa que não é número/data/código)
  const candidateLines = lines.filter(l => {
    if (l.length < 3 || l.length > 50) return false;
    if (/^\d+$/.test(l)) return false;
    if (PATTERNS.barcode.test(l)) return false;
    if (PATTERNS.date.test(l)) return false;
    if (PATTERNS.quantity.test(l)) return false;
    return true;
  });
  if (candidateLines.length > 0) {
    // Pega a primeira linha candidata como nome do produto
    result.product_name = candidateLines[0];
  }

  // 6. Categoria (baseado no nome do produto)
  if (result.product_name) {
    result.category = inferCategory(result.product_name);
  }

  return result;
}

function normalizeDate(dateStr: string): string | null {
  // Converte DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD → YYYY-MM-DD
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length !== 3) return null;

  let day: number, month: number, year: number;

  if (parts[0].length === 4) {
    // YYYY-MM-DD
    [year, month, day] = parts.map(Number);
  } else {
    // DD/MM/YYYY
    [day, month, year] = parts.map(Number);
    if (year < 100) year += 2000; // 25 → 2025
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function inferCategory(productName: string): 'hortifruti' | 'proteina' | 'grao' | 'laticinio' | 'panificado' | 'outro' {
  const name = productName.toLowerCase();

  const keywords: Record<string, string[]> = {
    hortifruti: ['tomate', 'cebola', 'batata', 'cenoura', 'alface', 'fruta', 'legume', 'verdura', 'maçã', 'banana', 'laranja', 'limão', 'alho', 'pimenta', 'cheiro-verde', 'couve', 'espinafre', 'brócolis', 'abobrinha', 'pepino', 'beterraba', 'inhame', 'mandioca', 'abóbora', 'chuchu', 'vagem', 'milho', 'ervilha'],
    proteina: ['carne', 'frango', 'peixe', 'ovo', 'linguiça', 'salsicha', 'presunto', 'mortadela', 'bacon', 'hambúrguer', 'almondega', 'kibe', 'proteína', 'soja', 'tofu', 'grão-de-bico', 'feijão', 'lentilha', 'grão'],
    grao: ['arroz', 'feijão', 'farinha', 'fubá', 'aveia', 'grão', 'cereal', 'macarrão', 'massa', 'espaguete', 'penne', 'parafuso', 'lasanha', 'nhoque', 'cuscuz', 'polenta', 'quinoa', 'trigo', 'centeio', 'cevada'],
    laticinio: ['leite', 'queijo', 'iogurte', 'manteiga', 'requeijão', 'creme de leite', 'leite condensado', 'doce de leite', 'ricota', 'cottage', 'laticínio'],
    panificado: ['pão', 'bolo', 'biscoito', 'torta', 'bisnaga', 'broa', 'pão de forma', 'pão francês', 'pão de queijo', 'rosca', 'sonho', 'pão de mel', 'panetone'],
  };

  for (const [cat, words] of Object.entries(keywords)) {
    if (words.some(w => name.includes(w))) {
      return cat as any;
    }
  }
  return 'outro';
}

async function processImage(imageData: string, language = 'por'): Promise<OcrOutput> {
  const startTime = performance.now();

  try {
    await initializeWorker(language);

    if (!worker) throw new Error('Worker não inicializado');

    const { data } = await worker.recognize(imageData);

    const parsed = parseOcrText(data.text);
    const confidence = data.confidence; // 0-100

    return {
      success: true,
      data: parsed,
      confidence,
      processingTimeMs: performance.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido no OCR',
      confidence: 0,
      processingTimeMs: performance.now() - startTime,
    };
  }
}

// Message handler
self.onmessage = async (event: MessageEvent<OcrInput>) => {
  const { imageData, language } = event.data;

  if (!imageData) {
    self.postMessage({ success: false, error: 'Nenhuma imagem fornecida', confidence: 0, processingTimeMs: 0 });
    return;
  }

  const result = await processImage(imageData, language);
  self.postMessage(result);
};

// Cleanup ao fechar
self.onclose = async () => {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
};

export {}; // Make it a module