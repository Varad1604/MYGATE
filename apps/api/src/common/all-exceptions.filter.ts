import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import type { Response } from "express";
import { AppException } from "./app-exception";
import { getRequestContext } from "./request-context";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const requestId = getRequestContext()?.requestId;

    const { status, body } = this.map(exception);

    if (status >= 500) {
      this.logger.error(
        `requestId=${requestId} → 500`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    res.status(status).json({ ...body, error: { ...body.error, requestId } });
  }

  private map(exception: unknown): { status: number; body: { error: { code: string; message: string; details?: unknown } } } {
    if (exception instanceof AppException) {
      return {
        status: exception.status,
        body: { error: { code: exception.code, message: exception.message, details: exception.details } },
      };
    }

    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          error: {
            code: "VALIDATION_FAILED",
            message: "Request validation failed.",
            details: exception.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === "string"
          ? payload
          : ((payload as Record<string, unknown>).message as string | string[] | undefined) ?? exception.message;
      return {
        status,
        body: {
          error: {
            code: mapHttpStatus(status),
            message: Array.isArray(message) ? message.join("; ") : message,
          },
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        return {
          status: HttpStatus.CONFLICT,
          body: { error: { code: "DUPLICATE_RECORD", message: "A record with these unique values already exists." } },
        };
      }
      if (exception.code === "P2025") {
        return {
          status: HttpStatus.NOT_FOUND,
          body: { error: { code: "NOT_FOUND", message: "Record not found." } },
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    };
  }
}

function mapHttpStatus(status: number): string {
  switch (status) {
    case 400: return "BAD_REQUEST";
    case 401: return "UNAUTHORIZED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 429: return "RATE_LIMITED";
    default: return "REQUEST_FAILED";
  }
}
