import type { MetricDecoratorOptions } from '../../open-telemetry.interface'
import { MetricType } from '../../open-telemetry.enums'
import { Metric } from './metric.decorator'

/**
 * Shorthand decorator for UpDownCounter metrics that can increase or decrease.
 *
 * @param options Metric configuration options (excluding type)
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @UpDownCounter({
 *   name: 'active_sessions',
 *   description: 'Number of active user sessions',
 *   attributes: { service: 'user-service' }
 * })
 * handleSessionChange(delta: number) {
 *   // Method can add or subtract from counter based on input
 * }
 * ```
 */
export function UpDownCounter(options: Omit<MetricDecoratorOptions, 'type'>): MethodDecorator {
  return Metric({
    ...options,
    type: MetricType.UP_DOWN_COUNTER,
  })
}
