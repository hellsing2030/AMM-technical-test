export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string) { super(message, 404); }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message: string) { super(message, 401); }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) { super(message, 409); }
}
