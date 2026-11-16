import { TestBed } from '@angular/core/testing';
import { DonationService } from './donation.service';
import { DexieService } from '../storage/dexie.db';
import { SyncQueueService } from '../sync/sync-queue.service';
import { ItemCategory } from '../../shared/models';

describe('DonationService', () => {
  let service: DonationService;
  let dexieSpy: jasmine.SpyObj<DexieService>;
  let syncQueueSpy: jasmine.SpyObj<SyncQueueService>;

  beforeEach(() => {
    const dexieSpyObj = jasmine.createSpyObj('DexieService', [
      'addDonation',
      'addItem',
      'getDonation',
      'getDonationsByStatus',
      'updateDonation',
    ]);

    const syncQueueSpyObj = jasmine.createSpyObj('SyncQueueService', [
      'enqueueCreate',
      'generateId',
    ]);

    TestBed.configureTestingModule({
      providers: [
        DonationService,
        { provide: DexieService, useValue: dexieSpyObj },
        { provide: SyncQueueService, useValue: syncQueueSpyObj },
      ],
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(DonationService);
    expect(service).toBeTruthy();
  });

  describe('createDonationWithItems', () => {
    it('should throw error for invalid donation input', async () => {
      const service = TestBed.inject(DonationService);
      const invalidInput = { donor_id: 'invalid-uuid', received_at: '2026-11-14T10:00:00Z', received_by: 'user-1' };
      await expectAsync(service.createDonationWithItems(invalidInput, [{
        donation_id: '',
        product_name: 'Test',
        category: 'hortifruti' as ItemCategory,
        quantity_kg: 1,
        unit: 'kg',
        expiration_date: '2026-12-01'
      }])).toBeRejectedWithError(/Doação inválida/);
    });

    it('should throw error for invalid item input', async () => {
      const service = TestBed.inject(DonationService);
      const invalidItems: Array<{ donation_id: string; product_name: string; category: ItemCategory; quantity_kg: number; unit: 'kg'; expiration_date: string }> = [{ 
        donation_id: '', 
        product_name: 'Test', 
        category: 'hortifruti', 
        quantity_kg: -1, 
        unit: 'kg', 
        expiration_date: '2026-12-01' 
      }];
      await expectAsync(service.createDonationWithItems({ donor_id: '550e8400-e29b-41d4-a716-446655440000', received_at: '2026-11-14T10:00:00Z', received_by: 'user-1' }, invalidItems))
        .toBeRejectedWithError(/Doação inválida/);
    });
  });

  describe('getDonation', () => {
    it('should be defined', () => {
      const service = TestBed.inject(DonationService);
      expect(service.getDonation).toBeDefined();
    });
  });

  describe('getDraftDonations', () => {
    it('should be defined', () => {
      const service = TestBed.inject(DonationService);
      expect(service.getDraftDonations).toBeDefined();
    });
  });

  describe('confirmDonation', () => {
    it('should be defined', () => {
      const service = TestBed.inject(DonationService);
      expect(service.confirmDonation).toBeDefined();
    });
  });
});