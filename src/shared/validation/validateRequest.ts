import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { badRequest } from '../errors/httpErrors';

type RequestParts = {
  body: Request['body'];
  params: Request['params'];
  query: Request['query'];
};

type SafeParseResult =
  | { success: true; data: any }
  | { success: false; error: unknown };

type RequestSchema = {
  safeParse?: (data: RequestParts) => SafeParseResult;
  parse?: (data: RequestParts) => any;
  validate?: (data: RequestParts) => {
    error?: { message?: string };
    value?: any;
  };
};

function getValidationMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Invalid request';
}

function applyValidatedData(req: Request, data: Partial<RequestParts>) {
  if (data.body !== undefined) {
    req.body = data.body;
  }

  if (data?.params && data.params !== undefined) {
    req.params = data.params;
  }
}

function validateRequest(schema: RequestSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = {
      body: req.body,
      params: req.params,
      query: req.query,
    };

    try {
      if (schema.safeParse) {
        const result = schema.safeParse(data);

        if (!result.success) {
          return next(badRequest(getValidationMessage(result.error)));
        }

        applyValidatedData(req, result.data);
        return next();
      }

      if (schema.parse) {
        applyValidatedData(req, schema.parse(data));
        return next();
      }

      if (schema.validate) {
        const result = schema.validate(data);

        if (result.error) {
          return next(badRequest(result.error.message || 'Invalid request'));
        }

        applyValidatedData(req, result.value || {});
        return next();
      }

      return next(badRequest('Invalid validation schema'));
    } catch (error) {
      return next(badRequest(getValidationMessage(error)));
    }
  };
}

export { validateRequest };
