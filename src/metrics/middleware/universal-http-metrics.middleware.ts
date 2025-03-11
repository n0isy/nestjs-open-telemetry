import type { Counter, Histogram } from '@opentelemetry/api'
import { Buffer } from 'node:buffer'
import { Injectable, NestMiddleware } from '@nestjs/common'
import { MetricAttributeNames } from '../../open-telemetry.enums'
import { GenericRequest } from '../../open-telemetry.interface'
import { OpenTelemetryService } from '../../open-telemetry.service'

// Generic response interface that works with Express/Fastify
interface GenericResponse {
  statusCode: number
  getHeader?: (name: string) => string | string[] | number | undefined
  setHeader?: (name: string, value: string | string[] | number) => void
  write: (...args: any[]) => any
  end: (...args: any[]) => any
  [key: string]: any
}

/**
 * Platform-agnostic middleware for collecting HTTP metrics.
 * Works with both Express and Fastify by using NestJS's request/response abstractions.
 */
@Injectable()
export class UniversalHttpMetricsMiddleware implements NestMiddleware {
  private requestCounter: Counter
  private requestDurationHistogram: Histogram
  private requestSizeHistogram: Histogram
  private responseSizeHistogram: Histogram

  constructor(private readonly openTelemetryService: OpenTelemetryService) {
    const meter = this.openTelemetryService.getMeter()

    // Create metrics
    this.requestCounter = meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
    })

    this.requestDurationHistogram = meter.createHistogram('http_request_duration_ms', {
      description: 'HTTP request duration in milliseconds',
      unit: 'ms',
    })

    this.requestSizeHistogram = meter.createHistogram('http_request_size_bytes', {
      description: 'HTTP request size in bytes',
      unit: 'bytes',
    })

    this.responseSizeHistogram = meter.createHistogram('http_response_size_bytes', {
      description: 'HTTP response size in bytes',
      unit: 'bytes',
    })
  }

  /**
   * Middleware handler to collect metrics for each HTTP request.
   */
  use(req: any, res: any, next: Function): void {
    const startTime = performance.now()

    // Extract information from request
    const method = req.method
    const url = req.url
    const originalUrl = (req as any).originalUrl || url // Handle Express specific property
    const route = this.getRouteFromRequest(req)

    // Common attributes for all metrics
    const baseAttributes = {
      [MetricAttributeNames.HTTP_METHOD]: method,
      [MetricAttributeNames.HTTP_URL]: originalUrl,
      [MetricAttributeNames.HTTP_ROUTE]: route || 'unknown',
    }

    // Record request size
    const requestSize = this.calculateRequestSize(req)
    this.requestSizeHistogram.record(requestSize, baseAttributes)

    // Increment request counter
    this.requestCounter.add(1, baseAttributes)

    // Track response size and status
    this.trackResponse(res, baseAttributes, startTime)

    next()
  }

  /**
   * Attempts to extract the route pattern from the request.
   * Works with both Express and Fastify.
   */
  private getRouteFromRequest(req: GenericRequest): string | null {
    // For Express
    if ((req as any).route && (req as any).route.path) {
      return (req as any).route.path
    }

    // For Fastify
    if ((req as any).routeOptions && (req as any).routeOptions.url) {
      return (req as any).routeOptions.url
    }

    // For NestJS internal routing
    if ((req as any).params && (req as any)._parsedUrl && (req as any)._parsedUrl.pathname) {
      return (req as any)._parsedUrl.pathname
    }

    return null
  }

  /**
   * Calculate request size in bytes.
   */
  private calculateRequestSize(req: GenericRequest): number {
    let size = 0

    // Headers size
    const headersSize = JSON.stringify(req.headers).length
    size += headersSize

    // Body size if available
    if (req.body) {
      const contentLength = req.headers ? req.headers['content-length'] : undefined
      const bodySize = contentLength
        ? Number.parseInt(contentLength as string, 10)
        : JSON.stringify(req.body).length

      size += bodySize
    }

    // Query params size
    if (req.query) {
      size += JSON.stringify(req.query).length
    }

    return size
  }

  /**
   * Track response metrics including size, status code, and duration.
   */
  private trackResponse(res: GenericResponse, baseAttributes: Record<string, string>, startTime: number): void {
    // Store original functions
    const originalEnd = res.end
    const originalWrite = res.write

    let responseSize = 0

    // Override write to track response size
    res.write = (...args: any[]) => {
      if (args[0]) {
        if (Buffer.isBuffer(args[0])) {
          responseSize += args[0].length
        }
        else if (typeof args[0] === 'string') {
          responseSize += Buffer.byteLength(args[0])
        }
      }
      return originalWrite.apply(res, args as any)
    }

    // Override end to finalize metrics
    res.end = (...args: any[]) => {
      // Add content to size if provided to end()
      if (args[0]) {
        if (Buffer.isBuffer(args[0])) {
          responseSize += args[0].length
        }
        else if (typeof args[0] === 'string') {
          responseSize += Buffer.byteLength(args[0])
        }
      }

      // Calculate duration
      const duration = performance.now() - startTime

      // Get status code
      const statusCode = res.statusCode.toString()

      // Create attributes for response metrics
      const responseAttributes = {
        ...baseAttributes,
        [MetricAttributeNames.HTTP_STATUS_CODE]: statusCode,
      }

      // Record metrics
      this.responseSizeHistogram.record(responseSize, responseAttributes)
      this.requestDurationHistogram.record(duration, responseAttributes)

      // Call original end
      return originalEnd.apply(res, args as any)
    }
  }
}
