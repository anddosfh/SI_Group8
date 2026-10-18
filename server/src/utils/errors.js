// A problem the client can fix (invalid input, unknown id). Anything else is a server fault.
export class UserError extends Error {}

// Answers UserErrors with the given status and hands every other error to the 500 handler in server.js.
export function sendError(res, next, status, error) {
  if (error instanceof UserError) return res.status(status).json({error:error.message});
  next(error);
}
