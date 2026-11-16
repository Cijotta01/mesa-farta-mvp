import { TestBed } from '@angular/core/testing';
import { ReportService } from './report.service';
import { AuthService } from '../auth/auth.service';

describe('ReportService', () => {
  let service: ReportService;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    const authSpyObj = jasmine.createSpyObj('AuthService', ['getAccessToken']);
    authSpyObj.getAccessToken.and.resolveTo('fake-token');

    TestBed.configureTestingModule({
      providers: [
        ReportService,
        { provide: AuthService, useValue: authSpyObj },
      ],
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(ReportService);
    expect(service).toBeTruthy();
  });

  describe('generateReport', () => {
    it('should throw error when not authenticated', async () => {
      const service = TestBed.inject(ReportService);
      const authSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
      authSpy.getAccessToken.and.resolveTo(null);

      await expectAsync(service.generateReport({
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        format: 'pdf'
      })).toBeRejectedWithError('Não autenticado');
    });
  });

  describe('calculateMetrics', () => {
    it('should be defined', () => {
      const service = TestBed.inject(ReportService);
      expect(service.calculateMetrics).toBeDefined();
    });
  });
});