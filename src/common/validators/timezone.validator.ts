import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function isValidTimeZone(timezone: string): boolean {
  if (!timezone || typeof timezone !== 'string') {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function IsTimeZone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTimeZone',
      target: object.constructor,
      propertyName,
      options: {
        message: '$property must be a valid IANA timezone',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && isValidTimeZone(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid IANA timezone`;
        },
      },
    });
  };
}
