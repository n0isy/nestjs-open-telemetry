import type { MetricDecoratorOptions } from '../../open-telemetry.interface'
import { MetricType } from '../../open-telemetry.enums'
import { Metric } from './metric.decorator'

/**
 * Shorthand decorator for Histogram metrics that track distributions of values.
 *
 * @param options Metric configuration options (excluding type)
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Histogram({
 *   name: 'http_request_duration_seconds',
 *   description: 'HTTP request duration in seconds',
 *   unit: 'ms',
 *   attributes: { service: 'user-service' }
 * })
 * async handleRequest() {
 *   // Method execution time will be recorded in histogram
 * }
 * ```
 */
export function Histogram(options: Omit<MetricDecoratorOptions, 'type'>): MethodDecorator {
  return Metric({
    ...options,
    type: MetricType.HISTOGRAM,
  })
}
