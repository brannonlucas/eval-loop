/**
 * Server-Sent Events (SSE) Streaming Utilities
 *
 * Creates SSE streams for long-running operations like competitions.
 * Clients can connect via EventSource or fetch with ReadableStream.
 */

export interface SSEStream {
  stream: ReadableStream<Uint8Array>
  send: (event: string, data: unknown) => void
  close: () => void
  isClosed: () => boolean
}

/**
 * Create a new SSE stream with send/close controls
 */
export function createSSEStream(): SSEStream {
  let controller: ReadableStreamDefaultController<Uint8Array>
  let closed = false
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
    cancel() {
      closed = true
    },
  })

  return {
    stream,

    send(event: string, data: unknown) {
      if (closed) return

      try {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      } catch {
        // Stream may have been closed by client
        closed = true
      }
    },

    close() {
      if (closed) return
      closed = true

      try {
        controller.close()
      } catch {
        // Already closed
      }
    },

    isClosed() {
      return closed
    },
  }
}

/**
 * Create SSE response headers
 */
export function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  }
}

/**
 * Send a keep-alive comment to prevent connection timeout
 */
export function sendKeepAlive(sse: SSEStream) {
  if (sse.isClosed()) return

  try {
    // SSE comment (starts with :)
    const encoder = new TextEncoder()
    // @ts-expect-error - accessing internal controller
    sse.stream.controller?.enqueue?.(encoder.encode(': keepalive\n\n'))
  } catch {
    // Ignore errors
  }
}
