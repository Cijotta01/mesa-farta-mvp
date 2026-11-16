import { TestBed } from '@angular/core/testing';
import { TaskService } from './task.service';
import { DexieService } from '../storage/dexie.db';
import { SyncQueueService } from '../sync/sync-queue.service';

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    const dexieSpyObj = jasmine.createSpyObj('DexieService', [
      'addTask',
      'getTask',
      'getTasksByVolunteer',
      'getTasksByItem',
      'getPendingTasks',
      'updateTask',
    ]);

    const syncQueueSpyObj = jasmine.createSpyObj('SyncQueueService', [
      'enqueueCreate',
      'enqueueUpdate',
      'generateId',
    ]);

    TestBed.configureTestingModule({
      providers: [
        TaskService,
        { provide: DexieService, useValue: dexieSpyObj },
        { provide: SyncQueueService, useValue: syncQueueSpyObj },
      ],
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(TaskService);
    expect(service).toBeTruthy();
  });

  describe('createTasksFromSuggestion', () => {
    it('should be defined', () => {
      const service = TestBed.inject(TaskService);
      expect(service.createTasksFromSuggestion).toBeDefined();
    });
  });

  describe('getTask', () => {
    it('should be defined', () => {
      const service = TestBed.inject(TaskService);
      expect(service.getTask).toBeDefined();
    });
  });

  describe('getPendingTasks', () => {
    it('should be defined', () => {
      const service = TestBed.inject(TaskService);
      expect(service.getPendingTasks).toBeDefined();
    });
  });

  describe('getTasksByVolunteer', () => {
    it('should be defined', () => {
      const service = TestBed.inject(TaskService);
      expect(service.getTasksByVolunteer).toBeDefined();
    });
  });

  describe('getTasksByItem', () => {
    it('should be defined', () => {
      const service = TestBed.inject(TaskService);
      expect(service.getTasksByItem).toBeDefined();
    });
  });

  describe('completeTask', () => {
    it('should be defined', () => {
      const service = TestBed.inject(TaskService);
      expect(service.completeTask).toBeDefined();
    });
  });

  describe('claimTask', () => {
    it('should be defined', () => {
      const service = TestBed.inject(TaskService);
      expect(service.claimTask).toBeDefined();
    });
  });
});