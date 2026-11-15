import { Injectable, inject } from '@angular/core';
import { OcrParsedResult } from './ocr.worker';
import { Subject } from 'rxjs';

type WorkerMessage =
  | { type: 'progress'; progress: number }
  | OcrWorkerResult;

@Injectable({ providedIn: 'root' })
export class OcrService {
  private worker: Worker | null = null;
  private pendingResolve: ((result: OcrWorkerResult) => void) | null = null;
  private progressSubject = new Subject<number>();
  progress$ = this.progressSubject.asObservable();

  constructor() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./ocr.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const data = event.data;
        // Progress updates from worker
        if ('type' in data && data.type === 'progress') {
          this.progressSubject.next(data.progress);
          return;
        }
        // Final result - narrow type
        if (this.pendingResolve) {
          this.pendingResolve(data as OcrWorkerResult);
          this.pendingResolve = null;
        }
      };
      this.worker.onerror = (error) => {
        console.error('[OCR] Worker error:', error);
        if (this.pendingResolve) {
          this.pendingResolve({
            success: false,
            error: 'Worker error: ' + error.message,
            confidence: 0,
            processingTimeMs: 0,
          });
          this.pendingResolve = null;
        }
      };
    }
  }

  /**
   * Processa imagem via OCR no Web Worker (não bloqueia UI)
   * @param imageData base64 data URL da imagem
   * @param language idioma (padrão 'por' para português)
   * @returns Promise com resultado parseado
   */
  async recognize(imageData: string, language = 'por'): Promise<OcrWorkerResult> {
    if (!this.worker) {
      // Fallback se Web Worker não suportado
      return {
        success: false,
        error: 'Web Worker não suportado neste navegador',
        confidence: 0,
        processingTimeMs: 0,
      };
    }

    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this.worker!.postMessage({ imageData, language });
    });
  }

  /**
   * Pré-processa imagem para otimizar OCR:
   * - Downscale para max 800x600
   * - Converte para JPEG 0.8 quality
   * - Retorna base64 data URL
   */
  async preprocessImage(file: File, maxWidth = 800, maxHeight = 600, quality = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        // Calcula novas dimensões mantendo aspect ratio
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Converte para JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Valida se arquivo é imagem suportada
   */
  validateImageFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Formato não suportado. Use JPEG, PNG ou WebP.' };
    }
    if (file.size > maxSize) {
      return { valid: false, error: 'Imagem muito grande (máx. 5MB).' };
    }
    return { valid: true };
  }

  /**
   * Termina o worker (cleanup)
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export interface OcrWorkerResult {
  success: boolean;
  data?: OcrParsedResult;
  error?: string;
  confidence: number;
  processingTimeMs: number;
}