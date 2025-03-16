import type { Counter, Histogram, Meter, ObservableGauge, UpDownCounter } from '@opentelemetry/api'
import { BeforeApplicationShutdown, Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { metrics } from '@opentelemetry/api'
import { MeterProvider } from '@opentelemetry/sdk-metrics'
import { MetricReader } from '@opentelemetry/sdk-metrics/build/src/export/MetricReader'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { PrometheusExporterInterface } from './open-telemetry.interface'

/**
 * Service for interfacing with OpenTelemetry.
 * Provides access to tracer and meter instances for creating spans and metrics.
 */
@Injectable()
export class OpenTelemetryService implements BeforeApplicationShutdown, OnModuleDestroy {
  private readonly meter: Meter
  private readonly meterProvider: MeterProvider
  constructor(private readonly sdk: NodeSDK, @Inject('PROMETHEUS_EXPORTER') private readonly metricsExporter: PrometheusExporterInterface, @Inject('PROMETHEUS_SERIALIZER') private readonly prometheusSerializer: any) {
    this.meterProvider = new MeterProvider()
    try {
      metrics.setGlobalMeterProvider(this.meterProvider)
      this.meterProvider.addMetricReader(this.metricsExporter as MetricReader)
    }
    catch (e) {
      if (String(e) !== 'Error: MetricReader can not be bound to a MeterProvider again.')
        throw e
    }
    // Get the global meter provider and create a meter
    this.meter = metrics.getMeter('default')
  }

  /**
   * Get the meter for creating metrics
   */
  public getMeter(): Meter {
    return this.meter
  }

  /**
   * Create a counter metric
   */
  public createCounter(name: string, options?: {
    description?: string
    unit?: string
  }): Counter {
    return this.meter.createCounter(name, options)
  }

  /**
   * Create a histogram metric
   */
  public createHistogram(name: string, options?: {
    description?: string
    unit?: string
  }): Histogram {
    return this.meter.createHistogram(name, options)
  }

  /**
   * Create an up-down counter metric
   */
  public createUpDownCounter(name: string, options?: {
    description?: string
    unit?: string
  }): UpDownCounter {
    return this.meter.createUpDownCounter(name, options)
  }

  /**
   * Create an observable gauge metric
   */
  public createObservableGauge(name: string, options?: {
    description?: string
    unit?: string
  }): ObservableGauge {
    return this.meter.createObservableGauge(name, options)
  }

  /**
   * Collect metrics from the meter provider
   */
  public async collectMetrics(): Promise<string> {
    if (!this.metricsExporter) {
      return '# Metrics collection is not available\n# Install @opentelemetry/exporter-prometheus package to enable metrics collection'
    }

    if (!this.prometheusSerializer) {
      return '# Metrics serialization is not available\n# Error initializing PrometheusSerializer'
    }

    try {
      // Use the exporter's collect method and PrometheusSerializer to format metrics
      const { resourceMetrics, errors } = await this.metricsExporter.collect()

      if (errors.length > 0) {
        console.error('Metrics collection errors:', errors)
      }

      return this.prometheusSerializer.serialize(resourceMetrics)
    }
    catch (error) {
      console.error('Error collecting metrics:', error)
      return `# Error collecting metrics: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  /**
   * Shutdown the SDK and its components
   */
  public async beforeApplicationShutdown(): Promise<void> {
    await this.meterProvider?.shutdown({ timeoutMillis: 100 })
    metrics.disable()
    await this.sdk?.shutdown()
  }

  public async onModuleDestroy(): Promise<void> {
    await this.meterProvider?.shutdown({ timeoutMillis: 100 })
    metrics.disable()
    await this.sdk?.shutdown()
  }
}
