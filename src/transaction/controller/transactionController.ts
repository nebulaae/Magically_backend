import { Request, Response } from "express";
import * as apiResponse from "../../../shared/utils/apiResponse";
import * as transactionService from "../service/transactionService";

export const getMyTransactions = async (req: Request, res: Response) => {
  const { page = "1", limit = "20" } = req.query;
  const result = await transactionService.getUserHistory(req.user.id, Number(page), Number(limit));
  apiResponse.success(res, result);
};