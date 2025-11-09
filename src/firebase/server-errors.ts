/**
 * @fileoverview Defines error classes for server-side Firebase operations.
 * These errors do not depend on client-side authentication state and are safe
 * to use in Genkit flows or other server environments.
 */

type ServerSecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  serverDetails?: string; // To capture the original server error message
};

/**
 * A custom error class for server-side Firestore permission errors.
 * It provides a structured error message without accessing client-side auth.
 */
export class ServerFirestorePermissionError extends Error {
  constructor(context: ServerSecurityRuleContext) {
    const message = `
============================================================
[SERVER] Firestore Permission Error:
------------------------------------------------------------
Operation: ${context.operation}
Path: ${context.path}
Details: A server-side process (e.g., Genkit flow) was denied
         permission to perform this operation. Check your
         firestore.rules to ensure that service accounts or
         AI workers have the appropriate permissions.
Original Error: ${context.serverDetails || 'No additional details provided.'}
============================================================
`;
    super(message);
    this.name = 'ServerFirestorePermissionError';
  }
}
