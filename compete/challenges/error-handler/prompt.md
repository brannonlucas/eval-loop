# API Error Handler

Create an API error handler utility for a Next.js application that provides:

1. **`handleApiError(error, request, options)`** - Main error handler that:
   - Returns a NextResponse with JSON body `{ success: false, error: string }`
   - Default status 500 with message "Internal server error"
   - Accepts custom `publicMessage` and `status` options
   - Handles non-Error objects (strings, plain objects)
   - Takes a `service` option for logging context

2. **`rateLimitedResponse(retryAfter?)`** - Returns 429 response:
   - Body: `{ success: false, error: "Too many requests" }`
   - `Retry-After` header (default 60 seconds)

3. **`validationErrorResponse(message)`** - Returns 400 response:
   - Body: `{ success: false, error: message }`

4. **`notFoundResponse(resource?)`** - Returns 404 response:
   - Body: `{ success: false, error: "${resource} not found" }`
   - Default resource is "Resource"

## Requirements

- Use Next.js `NextResponse` from `next/server`
- All responses should return JSON with `success: false` and an `error` message
- The implementation should be TypeScript with proper types

## Expected Exports

```typescript
export function handleApiError(
  error: unknown,
  request: Request,
  options: { service: string; publicMessage?: string; status?: number }
): NextResponse;

export function rateLimitedResponse(retryAfterSeconds?: number): NextResponse;
export function validationErrorResponse(message: string): NextResponse;
export function notFoundResponse(resource?: string): NextResponse;
```
