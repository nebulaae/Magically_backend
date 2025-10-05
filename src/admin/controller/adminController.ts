import { Request, Response } from "express";
import * as adminService from "../service/adminService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import logger from "../../../shared/utils/logger";

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const result = await adminService.loginAdmin(username, password);

  if (!result) {
    return apiResponse.unauthorized(res, "Invalid admin credentials");
  }

  apiResponse.success(res, result, "Admin login successful.");
};

export const getAllUsers = async (req: Request, res: Response) => {
  const users = await adminService.getAllUsers();
  apiResponse.success(res, users);
};

export const blockUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = await adminService.blockUser(userId);

  if (!user) {
    return apiResponse.notFound(res, "User not found");
  }

  apiResponse.success(res, null, `${user.username} has been blocked`);
};

export const unblockUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = await adminService.unblockUser(userId);

  if (!user) {
    return apiResponse.notFound(res, "User not found");
  }

  apiResponse.success(res, null, `${user.username} has been unblocked`);
};

export const deletePublication = async (req: Request, res: Response) => {
  const { publicationId } = req.params;
  const result = await adminService.deletePublication(publicationId);

  if (!result) {
    return apiResponse.notFound(res, "Publication not found");
  }

  apiResponse.success(res, null, "Publication was deleted successfully");
};

export const setPhotoOfTheDay = async (req: Request, res: Response) => {
  const { publicationId } = req.params;
  try {
    const success = await adminService.setPhotoOfTheDay(publicationId);
    if (!success) {
      return apiResponse.notFound(res, "Publication not found");
    }
    apiResponse.success(res, null, "Photo of the day was set successfully");
  } catch (error) {
    logger.error(`Set Photo of the Day error: ${error.message}`);
    apiResponse.internalError(res, "Error while setting Photo of the Day.");
  }
};
