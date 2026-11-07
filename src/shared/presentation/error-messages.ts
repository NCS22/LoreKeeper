import {
  AUTHENTICATION_ERROR_CODE,
  BUSINESS_RULE_VIOLATION_ERROR_CODE,
  EXTERNAL_PROVIDER_ERROR_CODE,
  INFRASTRUCTURE_ERROR_CODE,
  NOT_FOUND_ERROR_CODE,
} from "@/shared/domain/error-kinds";
import { VALIDATION_ERROR_CODE } from "@/shared/domain/validation-error";

export const UNKNOWN_ERROR_CODE = "UNKNOWN_ERROR";

/** The closed list of codes a failure can be answered with. */
export type ErrorCode =
  | typeof VALIDATION_ERROR_CODE
  | typeof AUTHENTICATION_ERROR_CODE
  | typeof NOT_FOUND_ERROR_CODE
  | typeof BUSINESS_RULE_VIOLATION_ERROR_CODE
  | typeof INFRASTRUCTURE_ERROR_CODE
  | typeof EXTERNAL_PROVIDER_ERROR_CODE
  | typeof UNKNOWN_ERROR_CODE;

/**
 * The generic sentence of each error kind. It never repeats the message of the error that was
 * thrown, so nothing internal can reach a response. A consumer that wants its own text chooses it
 * by code and field.
 */
export const ERROR_MESSAGE_BY_CODE: Readonly<Record<ErrorCode, string>> = {
  [VALIDATION_ERROR_CODE]: "Some of the submitted values are not valid.",
  [AUTHENTICATION_ERROR_CODE]: "Authentication failed. Check your credentials or sign in again.",
  [NOT_FOUND_ERROR_CODE]: "The requested resource was not found.",
  [BUSINESS_RULE_VIOLATION_ERROR_CODE]: "The request cannot be completed because it breaks a rule.",
  [INFRASTRUCTURE_ERROR_CODE]: "Something went wrong on our side. Try again later.",
  [EXTERNAL_PROVIDER_ERROR_CODE]: "An external service failed. Try again later.",
  [UNKNOWN_ERROR_CODE]: "Something went wrong. Try again later.",
};
