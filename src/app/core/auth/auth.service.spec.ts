import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { DexieService } from '../storage/dexie.db';
import { Router } from '@angular/router';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    const dexieSpy = jasmine.createSpyObj('DexieService', ['setUserProfile', 'clearUserProfile']);
    dexieSpy.setUserProfile.and.resolveTo('ok');
    dexieSpy.clearUserProfile.and.resolveTo();

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: DexieService, useValue: dexieSpy },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
      ],
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(AuthService);
    expect(service).toBeTruthy();
  });

  describe('sendMagicLink', () => {
    it('should be defined', () => {
      const service = TestBed.inject(AuthService);
      expect(service.sendMagicLink).toBeDefined();
    });
  });

  describe('signOut', () => {
    it('should be defined', () => {
      const service = TestBed.inject(AuthService);
      expect(service.signOut).toBeDefined();
    });
  });

  describe('getAccessToken', () => {
    it('should be defined', () => {
      const service = TestBed.inject(AuthService);
      expect(service.getAccessToken).toBeDefined();
    });
  });

  describe('computed signals', () => {
    it('should have isAuthenticated signal', () => {
      const service = TestBed.inject(AuthService);
      expect(service.isAuthenticated).toBeDefined();
    });

    it('should have role signal', () => {
      const service = TestBed.inject(AuthService);
      expect(service.role).toBeDefined();
    });

    it('should have isNutritionist signal', () => {
      const service = TestBed.inject(AuthService);
      expect(service.isNutritionist).toBeDefined();
    });

    it('should have isVolunteer signal', () => {
      const service = TestBed.inject(AuthService);
      expect(service.isVolunteer).toBeDefined();
    });

    it('should have isManager signal', () => {
      const service = TestBed.inject(AuthService);
      expect(service.isManager).toBeDefined();
    });
  });
});