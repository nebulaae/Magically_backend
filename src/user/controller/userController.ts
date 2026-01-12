import logger from "../../../shared/utils/logger";
import { Request, Response } from "express";
import * as userService from "../service/userService";
import * as userRepository from "../repository/userRepository";
import * as apiResponse from "../../../shared/utils/apiResponse";

const handleErrors = (error: Error, res: Response) => {
  logger.error(error.message);
  if (error.message.includes("not found"))
    return apiResponse.notFound(res, error.message);
  if (error.message.includes("already"))
    return apiResponse.conflict(res, error.message);
  if (error.message.includes("not following"))
    return apiResponse.notFound(res, error.message);
  if (error.message.includes("cannot follow yourself"))
    return apiResponse.badRequest(res, error.message);
  apiResponse.internalError(res, "Server error");
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
    const currentUser = req.user;
    const profile = await userService.getProfileByUsername(
      username,
      currentUser.id,
    );
    apiResponse.success(res, profile);
  } catch (error) {
    handleErrors(error, res);
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const profile = await userService.getMyProfile(userId);
    apiResponse.success(res, profile);
  } catch (error) {
    handleErrors(error, res);
  }
};

export const getMyFollowers = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const followers = await userService.getMyFollowers(userId);
    apiResponse.success(res, followers);
  } catch (error) {
    handleErrors(error, res);
  }
};

export const getMyFollowings = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const followings = await userService.getMyFollowings(userId);
    apiResponse.success(res, followings);
  } catch (error) {
    handleErrors(error, res);
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const user = await userService.updateProfile(userId, req.body);
    apiResponse.success(res, { user }, "Profile updated successfully");
  } catch (error) {
    handleErrors(error, res);
  }
};

export const updateAvatar = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    if (!req.file) {
      return apiResponse.badRequest(res, "No file uploaded.");
    }
    // Old avatar deletion logic can be triggered from service
    const avatarUrlPath = `/users/avatars/${req.file.filename}`;
    const user = await userService.updateAvatar(userId, avatarUrlPath);
    apiResponse.success(res, { user }, "Avatar updated successfully");
  } catch (error) {
    handleErrors(error, res);
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== "string") {
      return apiResponse.badRequest(res, "Search query is required");
    }
    const users = await userService.searchUsers(query, req.user.id);
    apiResponse.success(res, users);
  } catch (error) {
    handleErrors(error, res);
  }
};

export const subscribe = async (req: Request, res: Response) => {
  try {
    const followerId = req.user.id;
    const followingId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const result = await userService.subscribe(followerId, followingId);
    apiResponse.success(res, null, result.message);
  } catch (error) {
    handleErrors(error, res);
  }
};

export const unsubscribe = async (req: Request, res: Response) => {
  try {
    const followerId = req.user.id;
    const followingId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const result = await userService.unsubscribe(followerId, followingId);
    apiResponse.success(res, null, result.message);
  } catch (error) {
    handleErrors(error, res);
  }
};

export const getFollowers = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const user = await userRepository.findUserBy({ username });
    if (!user) return apiResponse.notFound(res, "User not found");
    const followers = await userService.getMyFollowers(user.id);
    apiResponse.success(res, followers);
  } catch (error) {
    handleErrors(error, res);
  }
};

export const getFollowing = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const user = await userRepository.findUserBy({ username });
    if (!user) return apiResponse.notFound(res, "User not found");
    const following = await userService.getMyFollowings(user.id);
    apiResponse.success(res, following);
  } catch (error) {
    handleErrors(error, res);
  }
};

export const changeRole = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const user = await userService.changeRoleToAdmin(userId);
    apiResponse.success(res, { user }, "User role updated to admin.");
  } catch (error) {
    handleErrors(error, res);
  }
};
