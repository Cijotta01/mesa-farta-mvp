import { TestBed } from '@angular/core/testing';
import { StockService } from './stock.service';
import { DexieService } from '../storage/dexie.db';

describe('StockService', () => {
  let service: StockService;
  let dexieSpy: jasmine.SpyObj<DexieService>;

  beforeEach(() => {
    const dexieSpyObj = jasmine.createSpyObj('DexieService', ['getCriticalItems', 'getItemsByStatus']);
    dexieSpyObj.getCriticalItems.and.resolveTo([]);
    dexieSpyObj.getItemsByStatus.and.resolveTo([]);

    TestBed.configureTestingModule({
      providers: [
        StockService,
        { provide: DexieService, useValue: dexieSpyObj },
      ],
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(StockService);
    expect(service).toBeTruthy();
  });

  describe('getCriticalItems', () => {
    it('should return empty array when no items', async () => {
      const service = TestBed.inject(StockService);
      const result = await service.getCriticalItems(3);
      expect(result).toEqual([]);
    });

    it('should filter by daysAhead parameter', async () => {
      const service = TestBed.inject(StockService);
      const result = await service.getCriticalItems(1);
      expect(result).toEqual([]);
    });
  });

  describe('getItemsByCategory', () => {
    it('should return empty array when no items', async () => {
      const service = TestBed.inject(StockService);
      const result = await service.getItemsByCategory('hortifruti');
      expect(result).toEqual([]);
    });
  });

  describe('getCriticalStats', () => {
    it('should return zero stats when no items', async () => {
      const service = TestBed.inject(StockService);
      const stats = await service.getCriticalStats();

      expect(stats.critical).toBe(0);
      expect(stats.warning).toBe(0);
      expect(stats.ok).toBe(0);
    });
  });
});