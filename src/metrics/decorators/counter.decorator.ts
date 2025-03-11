import type { MetricDecoratorOptions } from '../../open-telemetry.interface'
import { MetricType } from '../../open-telemetry.enums'
import { Metric } from './metric.decorator'

/**
 * Shorthand decorator for Counter metrics that only increase.
 *
 * @param options Metric configuration options (excluding type)
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Counter({
 *   name: 'http_requests_total',
 *   description: 'Total number of HTTP requests',
 *   attributes: { service: 'user-service' }
 * })
 * handleRequest() {
 *   // Method will increment the counter on each call
 * }
 * ```
 */
export function Counter(options: Omit<MetricDecoratorOptions, 'type'>): MethodDecorator {
  return Metric({
    ...options,
    type: MetricType.COUNTER,
  })
}
