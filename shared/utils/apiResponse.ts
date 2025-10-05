import { Response } from "express";

export interface ApiResponseData {
  success: boolean;
  status_code: number;
  message: string;
  data?: any;
  errors?: any;
}

export const success = (
  res: Response,
  data: any,
  message: string = "Success.",
  statusCode: number = 200,
): Response => {
  const response: ApiResponseData = {
    success: true,
    status_code: statusCode,
    message: message,
  };
  if (data !== null && data !== undefined) {
    response.data = data;
  }
  return res.status(statusCode).json(response);
};

export const error = (
  res: Response,
  message: string = "An error occurred.",
  statusCode: number = 500,
  errors?: any,
): Response => {
  const response: ApiResponseData = {
    success: false,
    status_code: statusCode,
    message: message,
  };
  if (errors) {
    response.errors = errors;
  }
  return res.status(statusCode).json(response);
};

export const badRequest = (
  res: Response,
  errors?: any,
  message: string = "Bad Request.",
): Response => {
  return error(res, message, 400, errors);
};

export const unauthorized = (
  res: Response,
  message: string = "Authentication required.",
): Response => {
  return error(res, message, 401);
};

export const forbidden = (
  res: Response,
  message: string = "Access denied.",
): Response => {
  return error(res, message, 403);
};

export const notFound = (
  res: Response,
  message: string = "Resource not found.",
): Response => {
  return error(res, message, 404);
};

export const methodNotAllowed = (
  res: Response,
  message: string = "Method Not Allowed.",
): Response => {
  return error(res, message, 405);
};

export const conflict = (
  res: Response,
  message: string = "A resource with this identifier already exists.",
): Response => {
  return error(res, message, 409);
};

export const validationError = (
  res: Response,
  errors: any,
  message: string = "Validation failed.",
): Response => {
  return error(res, message, 422, errors);
};

export const tooManyRequests = (
  res: Response,
  message: string = "Too many requests, please try again later.",
): Response => {
  return error(res, message, 429);
};

export const internalError = (
  res: Response,
  message: string = "An internal server error occurred.",
  errors?: any,
): Response => {
  // В продакшене не стоит отправлять детали ошибки клиенту.
  // Но можно передать их для логирования.
  return error(res, message, 500, errors);
};
