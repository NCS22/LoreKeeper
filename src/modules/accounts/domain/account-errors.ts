import { AuthenticationError, BusinessRuleViolationError } from "@/shared/domain/error-kinds";

/** Sign-up with an email whose comparable form already belongs to an account (the only business rule of sign-up). */
export class EmailAlreadyRegisteredError extends BusinessRuleViolationError {
  constructor() {
    super("An account with this email already exists.");
  }
}

/**
 * Sign-in failed. The message is the same for an unknown email and for a wrong password, so
 * the answer never reveals whether the email is registered.
 */
export class InvalidCredentialsError extends AuthenticationError {
  constructor() {
    super("The email or the password is incorrect.");
  }
}
