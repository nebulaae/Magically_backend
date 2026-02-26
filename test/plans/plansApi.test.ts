import { Request, Response } from 'express';
import * as plansController from '../../src/plans/controller/plansController';
import * as userController from '../../src/user/controller/userController';
import * as planService from '../../src/plans/service/planService';
import * as userPlanService from '../../src/plans/service/userPlanService';

jest.mock('../../src/plans/service/planService');
jest.mock('../../src/plans/service/userPlanService');
jest.mock('../../src/payment/service/paymentService', () => ({
  createPaymentWithToken: jest.fn().mockResolvedValue({
    payment: { id: 'payment-123' },
    redirectUrl: 'https://checkout.example.com/pay',
    paymentToken: 'token-abc',
  }),
}));

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });

function mockRes(): Response {
  return { status: mockStatus, json: mockJson } as unknown as Response;
}

describe('Plans API controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlans', () => {
    it('returns list of plans', async () => {
      const plans = [
        {
          id: 'p1',
          name: 'Pack',
          type: 'package' as const,
          tokenAmount: 100,
          periodDays: 30,
          price: 999,
          currency: 'RUB',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      (planService.getActivePlans as jest.Mock).mockResolvedValue(plans);
      const req = { query: {} } as Request;
      const res = mockRes();

      await plansController.getPlans(req, res);

      expect(planService.getActivePlans).toHaveBeenCalledWith({}, undefined);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { plans },
        })
      );
    });

    it('passes type and currency query params', async () => {
      (planService.getActivePlans as jest.Mock).mockResolvedValue([]);
      const req = {
        query: { type: 'subscription', currency: 'USD' },
      } as unknown as Request;
      const res = mockRes();

      await plansController.getPlans(req, res);

      expect(planService.getActivePlans).toHaveBeenCalledWith(
        { type: 'subscription' },
        'USD'
      );
    });

    it('returns 400 for invalid type', async () => {
      const req = { query: { type: 'invalid' } } as unknown as Request;
      const res = mockRes();

      await plansController.getPlans(req, res);

      expect(planService.getActivePlans).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(400);
    });
  });

  describe('getPlanById', () => {
    it('returns plan when found', async () => {
      const plan = {
        id: 'p1',
        name: 'Pack',
        type: 'package' as const,
        tokenAmount: 100,
        periodDays: 30,
        price: 999,
        currency: 'RUB',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (planService.getPlanById as jest.Mock).mockResolvedValue(plan);
      const req = { params: { id: 'p1' }, query: {} } as unknown as Request;
      const res = mockRes();

      await plansController.getPlanById(req, res);

      expect(planService.getPlanById).toHaveBeenCalledWith('p1', undefined);
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: plan,
        })
      );
    });

    it('returns 404 when plan not found', async () => {
      (planService.getPlanById as jest.Mock).mockResolvedValue(null);
      const req = {
        params: { id: 'missing' },
        query: {},
      } as unknown as Request;
      const res = mockRes();

      await plansController.getPlanById(req, res);

      expect(mockStatus).toHaveBeenCalledWith(404);
    });
  });

  describe('getMyPlan', () => {
    it('returns plan data when user has active plan', async () => {
      const planDto = {
        id: 'up1',
        userId: 'u1',
        planId: 'p1',
        planName: 'Pack',
        planType: 'package',
        status: 'active' as const,
        startDate: new Date(),
        endDate: new Date(),
        tokensFromPlan: 80,
        tokensFromTopup: 20,
        autoRenew: false,
        cancelledAt: null,
        gracePeriodEnd: null,
      };
      (userPlanService.getActiveUserPlan as jest.Mock).mockResolvedValue(
        planDto
      );
      const req = { user: { id: 'u1' } } as unknown as Request;
      const res = mockRes();

      await userController.getMyPlan(req, res);

      expect(userPlanService.getActiveUserPlan).toHaveBeenCalledWith('u1');
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            hasActivePlan: true,
            balance: 100,
            tokensFromPlan: 80,
            tokensFromTopup: 20,
            status: 'active',
            planName: 'Pack',
          }),
        })
      );
    });

    it('returns noplan when user has no plan', async () => {
      (userPlanService.getActiveUserPlan as jest.Mock).mockResolvedValue(null);
      const req = { user: { id: 'u1' } } as unknown as Request;
      const res = mockRes();

      await userController.getMyPlan(req, res);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hasActivePlan: false,
            balance: 0,
            status: 'noplan',
          }),
        })
      );
    });
  });
});
