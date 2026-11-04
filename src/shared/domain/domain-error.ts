/**
 * Base class of every error the domain and the use cases throw on purpose.
 * The `code` is stable: callers and the UI decide what to do from it, never from the message.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
