import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { parseDateOnly } from '../utils/date-only';

@ValidatorConstraint({ name: 'isDateOnly', async: false })
export class IsDateOnlyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const date = parseDateOnly(value);
    return date !== null && date.getTime() <= Date.now();
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid date in YYYY-MM-DD format and cannot be in the future.`;
  }
}

export function IsDateOnly(options?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsDateOnlyConstraint,
    });
  };
}
