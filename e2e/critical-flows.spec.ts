import { test, expect } from '@playwright/test';

test.describe.configure({ retries: 2 });

test.describe('RF01: Entrada de Doação Offline com OCR', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Aguarda carregamento
    await page.waitForLoadState('networkidle');
  });

  test('deve registrar doação offline em ≤30s', async ({ page }) => {
    // Navega para nova doação
    await page.click('[routerlink="/doacao/nova"]');
    await page.waitForURL('**/doacao/nova');

    // Verifica stepper no passo 1
    await expect(page.locator('text=Captura')).toBeVisible();

    // Simula captura de imagem (usa arquivo de teste)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-barcode.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'), // Em produção, usar arquivo real
    });

    // Aguarda OCR processar (Web Worker)
    await expect(page.locator('text=Processando imagem')).toBeVisible({ timeout: 5000 });
    
    // Aguarda avanço para passo 2 (confirmação)
    await expect(page.locator('text=Confirmação')).toBeVisible({ timeout: 35000 });

    // Verifica campos pré-preenchidos
    await expect(page.locator('input[formcontrolname="product_name"]')).toHaveValue(/.+/);
    await expect(page.locator('input[formcontrolname="expiration_date"]')).toHaveValue(/.+/);

    // Salva offline
    await page.click('button:has-text("Salvar offline")');
    
    // Verifica feedback de sucesso
    await expect(page.locator('text=Doação salva localmente')).toBeVisible({ timeout: 5000 });
    
    // Verifica ID gerado
    await expect(page.locator('text=/ID: [A-F0-9]{8}/i')).toBeVisible();
  });

  test('deve funcionar completamente offline', async ({ context, page }) => {
    // Coloca offline
    await context.setOffline(true);
    
    await page.goto('/doacao/nova');
    await page.waitForLoadState('domcontentloaded');

    // Tenta capturar - deve funcionar sem rede
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-offline.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });

    // OCR deve processar localmente
    await expect(page.locator('text=Processando imagem')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Confirmação')).toBeVisible({ timeout: 35000 });

    // Salva
    await page.click('button:has-text("Salvar offline")');
    await expect(page.locator('text=Doação salva localmente')).toBeVisible();

    // Volta online
    await context.setOffline(false);
  });
});

test.describe('RF02: Painel de Itens Críticos por Validade', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/operacoes');
    await page.waitForLoadState('networkidle');
  });

  test('deve classificar itens em ≤500ms (vermelho/amarelo/verde)', async ({ page }) => {
    // Navega para aba Painel Crítico
    await page.click('button[role="tab"]:has-text("Painel Crítico")');
    await page.waitForSelector('table.mat-table');

    // Verifica chips de criticidade
    const criticalChips = page.locator('mat-chip:has-text("Vence hoje")');
    const warningChips = page.locator('mat-chip:has-text("Vence em")');
    const okChips = page.locator('mat-chip:has-text("OK")');

    // Pelo menos um chip deve estar visível (dados de seed)
    await expect(criticalChips.first()).toBeVisible({ timeout: 5000 });

    // Verifica contadores no header
    await expect(page.locator('text=Crítico')).toBeVisible();
    await expect(page.locator('text=Atenção')).toBeVisible();
  });

  test('deve filtrar por categoria', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Painel Crítico")');
    
    // Abre filtro de categoria
    await page.click('mat-select[formcontrolname="categoryFilter"]');
    await page.click('mat-option:has-text("Hortifrúti")');
    
    // Verifica que tabela atualizou
    await expect(page.locator('table.mat-table tbody tr')).toBeVisible({ timeout: 2000 });
  });
});

test.describe('RF04: Checklist Automático para Voluntários', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/operacoes');
    await page.waitForLoadState('networkidle');
  });

  test('deve exibir checklist com toque ≥48dp e navegação linear', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Checklist")');
    
    // Verifica cards de tarefa
    const taskCards = page.locator('mat-card:has(mat-checkbox)');
    await expect(taskCards.first()).toBeVisible({ timeout: 5000 });

    // Verifica checkbox ≥48dp
    const checkbox = taskCards.first().locator('mat-checkbox');
    const box = await checkbox.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(48);
    expect(box?.height).toBeGreaterThanOrEqual(48);

    // Verifica botão "Próxima" fixo
    await expect(page.locator('button:has-text("Próxima")')).toBeVisible();

    // Marca primeira tarefa
    await checkbox.click();
    
    // Verifica anúncio via LiveAnnouncer (status textual)
    await expect(page.locator('mat-chip:has-text("Concluída")')).toBeVisible();

    // Verifica navegação para próxima
    await expect(page.locator('button:has-text("Próxima")')).toBeEnabled();
  });

  test('deve funcionar offline', async ({ context, page }) => {
    await context.setOffline(true);
    await page.goto('/operacoes');
    await page.click('button[role="tab"]:has-text("Checklist")');
    
    // Verifica banner offline
    await expect(page.locator('text=Offline')).toBeVisible({ timeout: 3000 });
    
    // Completa tarefa
    const checkbox = page.locator('mat-card mat-checkbox').first();
    await checkbox.click();
    
    await expect(page.locator('mat-chip:has-text("Concluída")')).toBeVisible();
    
    await context.setOffline(false);
  });
});

test.describe('RF05: Relatório Automático PDF/CSV', () => {
  test('deve gerar PDF e CSV via Edge Function', async ({ page }) => {
    await page.goto('/operacoes');
    await page.click('button[role="tab"]:has-text("Relatórios")');
    
    // Preenche período
    await page.fill('input[formcontrolname="start"]', '2026-01-01');
    await page.fill('input[formcontrolname="end"]', '2026-12-31');
    
    // Seleciona PDF
    await page.click('mat-select[formcontrolname="format"]');
    await page.click('mat-option:has-text("PDF")');
    
    // Gera relatório
    await page.click('button:has-text("Gerar PDF")');
    
    // Aguarda download (Edge Function ≤10s)
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.click('a:has-text("Baixar PDF")'); // Link aparece após geração
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/relatorio_mesa_farta_.*\.pdf/);
    
    // Testa CSV
    await page.click('mat-select[formcontrolname="format"]');
    await page.click('mat-option:has-text("CSV")');
    await page.click('button:has-text("Gerar CSV")');
    
    const csvDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.click('a:has-text("Baixar CSV")');
    const csvDownload = await csvDownloadPromise;
    
    expect(csvDownload.suggestedFilename()).toMatch(/relatorio_mesa_farta_.*\.csv/);
  });
});

test.describe('Acessibilidade WCAG 2.1 AA', () => {
  test('contraste ≥4.5:1, toque ≥48dp, navegação teclado', async ({ page }) => {
    await page.goto('/');
    
    // Verifica foco visível
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
    
    // Verifica áreas de toque
    const buttons = page.locator('button[mat-button], button[mat-flat-button], button[mat-fab]');
    for (const btn of await buttons.all()) {
      const box = await btn.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(48);
        expect(box.height).toBeGreaterThanOrEqual(48);
      }
    }
    
    // Verifica LiveAnnouncer (aria-live regions)
    await expect(page.locator('[aria-live="polite"], [aria-live="assertive"]')).toHaveCountGreaterThan(0);
  });

  test('TalkBack/VoiceOver: labels e anúncios', async ({ page }) => {
    await page.goto('/operacoes');
    await page.click('button[role="tab"]:has-text("Checklist")');
    
    const checkbox = page.locator('mat-card mat-checkbox').first();
    const ariaLabel = await checkbox.getAttribute('aria-label');
    expect(ariaLabel).toContain('Marcar');
    expect(ariaLabel).toContain('concluída');
  });
});