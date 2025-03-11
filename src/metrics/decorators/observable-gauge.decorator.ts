import type { MetricDecoratorOptions } from '../../open-telemetry.interface'
import { MetricType } from '../../open-telemetry.enums'
import { Metric } from './metric.decorator'

/**
 * Shorthand decorator for ObservableGauge metrics that observe current values.
 *
 * @param options Metric configuration options (excluding type)
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @ObservableGauge({
 *   name: 'cpu_usage_percent',
 *   description: 'Current CPU usage percentage',
 *   unit: '%',
 *   attributes: { service: 'user-service' }
 * })
 * getCpuUsage() {
 *   // Method returns current value to be observed
 *   return process.cpuUsage().user / 1000000;
 * }
 * ```
 */
export function ObservableGauge(options: Omit<MetricDecoratorOptions, 'type'>): MethodDecorator {
  return Metric({
    ...options,
    type: MetricType.OBSERVABLE_GAUGE,
  })
}
