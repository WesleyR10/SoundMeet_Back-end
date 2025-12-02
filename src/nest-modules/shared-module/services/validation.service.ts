import { Injectable, Logger } from "@nestjs/common";
import { validate, ValidationError } from "class-validator";
import { plainToClass } from "class-transformer";

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  formattedErrors?: Record<string, string[]>;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  /**
   * Validate a DTO using class-validator
   */
  async validateDto<T extends object>(
    dtoClass: new () => T,
    data: any,
    options?: {
      skipMissingProperties?: boolean;
      whitelist?: boolean;
      forbidNonWhitelisted?: boolean;
    },
  ): Promise<ValidationResult> {
    try {
      const dto = plainToClass(dtoClass, data);
      const errors = await validate(dto, {
        skipMissingProperties: options?.skipMissingProperties || false,
        whitelist: options?.whitelist || true,
        forbidNonWhitelisted: options?.forbidNonWhitelisted || true,
      });

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
      };

      if (errors.length > 0) {
        result.formattedErrors = this.formatValidationErrors(errors);
        this.logger.debug("Validation failed:", result.formattedErrors);
      }

      return result;
    } catch (error) {
      this.logger.error("Error during validation:", error);
      throw new Error("Validation process failed");
    }
  }

  /**
   * Format validation errors into a more readable structure
   */
  private formatValidationErrors(
    errors: ValidationError[],
  ): Record<string, string[]> {
    const formatted: Record<string, string[]> = {};

    const processError = (error: ValidationError, prefix = "") => {
      const property = prefix ? `${prefix}.${error.property}` : error.property;

      if (error.constraints) {
        formatted[property] = Object.values(error.constraints);
      }

      if (error.children && error.children.length > 0) {
        error.children.forEach((child) => processError(child, property));
      }
    };

    errors.forEach((error) => processError(error));
    return formatted;
  }

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format (Brazilian)
   */
  isValidPhoneNumber(phone: string): boolean {
    // Remove all non-numeric characters
    const cleanPhone = phone.replace(/\D/g, "");

    // Brazilian phone numbers: 10 or 11 digits
    // Format: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
    return cleanPhone.length === 10 || cleanPhone.length === 11;
  }

  /**
   * Validate CPF (Brazilian individual taxpayer registry)
   */
  isValidCPF(cpf: string): boolean {
    const cleanCPF = cpf.replace(/\D/g, "");

    if (cleanCPF.length !== 11) return false;

    // Check for known invalid CPFs
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    // Validate check digits
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
  }

  /**
   * Validate CNPJ (Brazilian company registry)
   */
  isValidCNPJ(cnpj: string): boolean {
    const cleanCNPJ = cnpj.replace(/\D/g, "");

    if (cleanCNPJ.length !== 14) return false;

    // Check for known invalid CNPJs
    if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;

    // Validate check digits
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleanCNPJ.charAt(i)) * weights1[i];
    }
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;

    if (digit1 !== parseInt(cleanCNPJ.charAt(12))) return false;

    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleanCNPJ.charAt(i)) * weights2[i];
    }
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;

    return digit2 === parseInt(cleanCNPJ.charAt(13));
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push("Password must be at least 8 characters long");
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push("Password must contain at least one uppercase letter");
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push("Password must contain at least one lowercase letter");
    }

    // Number check
    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push("Password must contain at least one number");
    }

    // Special character check
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      feedback.push("Password must contain at least one special character");
    }

    return {
      isValid: score >= 4,
      score,
      feedback,
    };
  }

  /**
   * Sanitize string input
   */
  sanitizeString(input: string): string {
    return input.trim().replace(/[<>"'&]/g, (match) => {
      const entities: Record<string, string> = {
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "&": "&amp;",
      };
      return entities[match] || match;
    });
  }

  /**
   * Validate URL format
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
