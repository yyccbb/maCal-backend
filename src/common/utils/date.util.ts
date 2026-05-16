import { BadRequestException } from '@nestjs/common';

export function parseIsoDate(value: string | null | undefined, fieldName: string): Date | null {
  if (value == null) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${fieldName} must be a valid ISO datetime`);
  }

  return parsed;
}

export function requireDate(value: Date | null, fieldName: string): Date {
  if (!value) {
    throw new BadRequestException(`${fieldName} is required`);
  }

  return value;
}
