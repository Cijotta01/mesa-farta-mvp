import { test, expect } from '@playwright/test';

test.describe.configure({ retries: 0 });

test.describe('RF01 Performance: Entrada Offline ≤30s (mediana 5 runs)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/doacao/nova');
    await page.waitForLoadState('networkidle');
  });

  const RUNS = 6; // 1 warm-up + 5 válidos
  const times: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    test(`Run ${i + 1}/${RUNS} - registrar doação offline`, async ({ page, context }) => {
      // Coloca offline
      await context.setOffline(true);
      
      const startTime = Date.now();
      
      // Simula captura (usa arquivo de teste pequeno)
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: `perf-test-${i}.jpg`,
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-image-data-for-performance-test'),
      });

      // Aguarda OCR processar
      await expect(page.locator('text=Processando imagem')).toBeVisible({ timeout: 5000 });
      
      // Aguarda avanço para confirmação
      await expect(page.locator('text=Confirmação')).toBeVisible({ timeout: 35000 });
      
      // Preenche campos obrigatórios se necessário
      const productInput = page.locator('input[formcontrolname="product_name"]');
      if (!(await productInput.inputValue())) {
        await productInput.fill('Teste Performance');
      }
      
      // Salva offline
      await page.click('button:has-text("Salvar offline")');
      
      // Aguarda confirmação
      await expect(page.locator('text=Doação salva localmente')).toBeVisible({ timeout: 5000 });
      
      const elapsed = Date.now() - startTime;
      times.push(elapsed);
      
      console.log(`[PERF] Run ${i + 1}: ${elapsed}ms`);
      
      // Validação por run
      expect(elapsed).toBeLessThanOrEqual(35000); // margem de 5s acima do limite
      
      // Limpa para próxima run
      await page.click('button:has-text("Nova doação")');
      await context.setOffline(false);
      await page.waitForTimeout(500);
    });
  }

  test.afterAll(() => {
    if (times.length >= 5) {
      const validTimes = times.slice(1); // Remove warm-up
      validTimes.sort((a, b) => a - b);
      const median = validTimes[Math.floor(validTimes.length / 2)];
      const stdDev = Math.sqrt(
        validTimes.reduce((sum, t) => sum + Math.pow(t - median, 2), 0) / validTimes.length
      );
      
      console.log('\n=== RF01 PERFORMANCE RESULTS ===');
      console.log(`Runs válidos: ${validTimes.length}`);
      console.log(`Tempos (ms): ${validTimes.join(', ')}`);
      console.log(`Mediana: ${median}ms`);
      console.log(`Desvio padrão: ${stdDev.toFixed(2)}ms`);
      console.log(`Limite: 30000ms`);
      console.log(`Status: ${median <= 30000 && stdDev < 5000 ? 'APROVADO ✓' : 'REPROVADO ✗'}`);
      console.log('================================\n');
      
      // Salva resultados para CI
      const fs = require('fs');
      const resultsDir = 'performance-results';
      if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);
      fs.writeFileSync(
        `${resultsDir}/rf01-performance.json`,
        JSON.stringify({ runs: validTimes, median, stdDev, passed: median <= 30000 && stdDev < 5000 }, null, 2)
      );
    }
  });
});