// A problem the client can fix (invalid input, unknown id). Anything else is a server fault.
// The optional status overrides the controller's default, e.g. 409 when the ERP reports too little stock.
export class UserError extends Error {
  constructor(message, status) { super(message); if (status) this.status = status; }
}

// Lab 3: the Mini-ERP could not be reached (network error, timeout, 5xx) or rejected the shop's login.
// server.js answers it with 503; the shop itself is fine and the request can be tried again later.
export class ErpUnavailableError extends Error {}

// Answers UserErrors with their own or the given status and hands every other error to the handler in server.js.
export function sendError(res, next, status, error) {
  if (error instanceof UserError) return res.status(error.status ?? status).json({error:error.message});
  next(error);
}
