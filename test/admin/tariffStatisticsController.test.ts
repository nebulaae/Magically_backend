import { Request, Response } from 'express';
import * as adminController from '../../src/admin/controller/adminController';
import * as adminService from '../../src/admin/service/adminService';

jest.mock('../../src/admin/service/adminService');

const mockJson = jest.fn();
const mockStatus = jest.fn().mockReturnValue({ json: mockJson });

function mockRes(): Response {
  return { status: mockStatus, json: mockJson } as unknown as Response;
}

describe('Admin tariff statistics controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns statistics with parsed dates', async () => {
    (adminService.getTariffStatistics as jest.Mock).mockResolvedValue({
      activeSubscriptions: 5,
    });

    const req = {
      query: { from: '2025-01-01', to: '2025-01-31' },
    } as unknown as Request;
    const res = mockRes();

    await adminController.getTariffStatistics(req, res);

    expect(adminService.getTariffStatistics).toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(200);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          activeSubscriptions: 5,
        }),
      })
    );
  });

  it('returns 400 for invalid from date', async () => {
    const req = {
      query: { from: 'invalid-date' },
    } as unknown as Request;
    const res = mockRes();

    await adminController.getTariffStatistics(req, res);

    expect(adminService.getTariffStatistics).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(400);
  });
});
