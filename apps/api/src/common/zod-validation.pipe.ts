import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { ZodError, type ZodSchema } from "zod";

/**
 * Parses and validates route input with a Zod schema.
 * Usage: `@Body(new ZodValidationPipe(Schema))`.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }
}

export type { ZodError };
