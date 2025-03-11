import type { MetricDecoratorOptions } from '../../open-telemetry.interface'
import { METRIC_METADATA } from '../../open-telemetry.enums'

/**
 * Decorator for instrumenting methods with metrics.
 *
 * @param options Metric configuration options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Metric({
 *   name: 'http_requests',
 *   type: MetricType.COUNTER,
 *   description: 'Number of HTTP requests',
 *   attributes: { service: 'user-service' }
 * })
 * handleRequest() {
 *   // This method will be instrumented to count each invocation
 * }
 * ```
 */
export function Metric(options: MetricDecoratorOptions): MethodDecorator {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(METRIC_METADATA, {
      ...options,
      methodName: propertyKey.toString(),
    }, descriptor.value)

    return descriptor
  }
}
