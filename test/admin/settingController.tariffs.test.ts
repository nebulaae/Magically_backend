import { Request, Response } from 'express';
import * as settingController from '../../src/admin/controller/settingController';
import * as settingService from '../../src/admin/service/settingService';

jest.mock('../../src/admin/service/settingService');

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });

function mockRes(): Response {
  return { status: mockStatus, json: mockJson } as unknown as Response;
}

describe('Admin tariff settings controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns trial and grace settings', async () => {
    (settingService.getSettings as jest.Mock).mockResolvedValue({
      trialTokens: 50,
      trialPeriodDays: 7,
      subscriptionGracePeriodDays: 5,
    });

    const req = {} as Request;
    const res = mockRes();

    await settingController.getTariffSettings(req, res);

    expect(settingService.getSettings).toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: {
          trialTokens: 50,
          trialPeriodDays: 7,
          gracePeriodDays: 5,
        },
      })
    );
  });

  it('updates trial and grace settings', async () => {
    (settingService.updateSettings as jest.Mock).mockResolvedValue({
      trialTokens: 60,
      trialPeriodDays: 10,
      subscriptionGracePeriodDays: 4,
    });

    const req = {
      body: { trialTokens: 60, trialPeriodDays: 10, gracePeriodDays: 4 },
    } as unknown as Request;
    const res = mockRes();

    await settingController.updateTariffSettings(req, res);

    expect(settingService.updateSettings).toHaveBeenCalledWith({
      trialTokens: 60,
      trialPeriodDays: 10,
      subscriptionGracePeriodDays: 4,
    });
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: {
          trialTokens: 60,
          trialPeriodDays: 10,
          gracePeriodDays: 4,
        },
      })
    );
  });
});

