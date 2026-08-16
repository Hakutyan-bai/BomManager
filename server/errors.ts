// 统一错误模型与 HTTP 状态码映射。

export type HttpStatus = 200 | 201 | 400 | 404 | 409 | 500;

export class AppError extends Error {
  constructor(
    public readonly status: HttpStatus,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function badRequest(message: string, code = "VALIDATION_ERROR"): AppError {
  return new AppError(400, code, message);
}

export function notFound(message: string): AppError {
  return new AppError(404, "NOT_FOUND", message);
}

export function conflict(message: string): AppError {
  return new AppError(409, "CONFLICT", message);
}

export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}
