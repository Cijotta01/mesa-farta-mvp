import { TestBed } from '@angular/core/testing';
import { DonationService } from './donation.service';
import { DexieService } from '../storage/dexie.db';
import { SyncQueueService } from '../sync/sync-queue.service';

describe('DonationService', () => {
  let service: DonationService;

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
      await expectAsync(service.createDonationWithItems(invalidInput, [{ donation_id: '', product_name: 'Test', category: 'hortifruti' as const, quantity_kg: 1, unit: 'kg', expiration_date: '2026-12-01' }]))
        .toBeRejectedWithError(/Doação inválida/);
    });
  });
});