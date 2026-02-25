import { Request, Response } from 'express';
import * as planAdminController from '../../src/admin/controller/planController';
import * as planService from '../../src/plans/service/planService';

jest.mock('../../src/plans/service/planService');

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });

function mockRes(): Response {
  return { status: mockStatus, json: mockJson } as unknown as Response;
}

describe('Admin plan controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists plans with optional filters', async () => {
    (planService.getAllPlans as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        name: 'Pack',
        description: null,
        icon: null,
        type: 'package',
        tokenAmount: 100,
        periodDays: 30,
        price: 999,
        currency: 'RUB',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const req = {
      query: { type: 'package', isActive: 'true' },
    } as unknown as Request;
    const res = mockRes();

    await planAdminController.listPlans(req, res);

    expect(planService.getAllPlans).toHaveBeenCalledWith({
      type: 'package',
      isActive: true,
    });
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { plans: expect.any(Array) },
      })
    );
  });

  it('returns 400 for invalid type', async () => {
    const req = { query: { type: 'invalid' } } as unknown as Request;
    const res = mockRes();

    await planAdminController.listPlans(req, res);

    expect(planService.getAllPlans).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(400);
  });

  it('creates plan', async () => {
    (planService.createPlan as jest.Mock).mockResolvedValue({
      id: 'p1',
      name: 'New Pack',
      description: null,
      icon: null,
      type: 'package',
      tokenAmount: 100,
      periodDays: 30,
      price: 999,
      currency: 'RUB',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = {
      body: {
        name: 'New Pack',
        type: 'package',
        tokenAmount: 100,
        periodDays: 30,
        price: 999,
        currency: 'RUB',
      },
    } as unknown as Request;
    const res = mockRes();

    await planAdminController.createPlan(req, res);

    expect(planService.createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Pack',
        type: 'package',
        tokenAmount: 100,
        periodDays: 30,
        price: 999,
      })
    );
    expect(mockStatus).toHaveBeenCalledWith(200);
  });

  it('updates plan', async () => {
    (planService.updatePlan as jest.Mock).mockResolvedValue({
      id: 'p1',
      name: 'Updated',
      description: null,
      icon: null,
      type: 'package',
      tokenAmount: 100,
      periodDays: 30,
      price: 999,
      currency: 'RUB',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = {
      params: { planId: 'p1' },
      body: { name: 'Updated' },
    } as unknown as Request;
    const res = mockRes();

    await planAdminController.updatePlan(req, res);

    expect(planService.updatePlan).toHaveBeenCalledWith('p1', {
      name: 'Updated',
      description: undefined,
      icon: undefined,
      type: undefined,
      tokenAmount: undefined,
      periodDays: null,
      price: undefined,
      currency: undefined,
      isActive: undefined,
    });
    expect(mockStatus).toHaveBeenCalledWith(200);
  });

  it('deactivates plan', async () => {
    (planService.deactivatePlan as jest.Mock).mockResolvedValue({
      id: 'p1',
      isActive: false,
    });

    const req = { params: { planId: 'p1' } } as unknown as Request;
    const res = mockRes();

    await planAdminController.deactivatePlan(req, res);

    expect(planService.deactivatePlan).toHaveBeenCalledWith('p1');
    expect(mockStatus).toHaveBeenCalledWith(200);
  });
});

