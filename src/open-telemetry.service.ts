import type { BeforeApplicationShutdown } from '@nestjs/common'
import type { Counter, Histogram, Meter, ObservableGauge, UpDownCounter } from '@opentelemetry/api'
import { Injectable } from '@nestjs/common'
import { metrics } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { PrometheusExporterInterface } from './open-telemetry.interface'

/**
 * Service for interfacing with OpenTelemetry.
 * Provides access to tracer and meter instances for creating spans and metrics.
 */
@Injectable()
export class OpenTelemetryService implements BeforeApplicationShutdown {
  private readonly meter: Meter
  private metricsExporter: PrometheusExporterInterface | null = null

  constructor(private readonly sdk: NodeSDK) {
    // Get the global meter provider and create a meter
    this.meter = metrics.getMeter('default')
  }

  /**
   * Set the metrics exporter for collecting metrics
   */
  public setMetricsExporter(exporter: PrometheusExporterInterface): void {
    this.metricsExporter = exporter
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
  public collectMetrics(): string {
    if (!this.metricsExporter) {
      return '# Metrics collection is not available\n# Install @opentelemetry/exporter-prometheus package to enable metrics collection'
    }

    try {
      // Use the exporter's getMetrics method to format metrics in Prometheus format
      // This avoids starting a separate HTTP server while still getting the formatted metrics
      return this.metricsExporter.getMetrics()
    }
    catch (error) {
      return `# Error collecting metrics: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  /**
   * Shutdown the SDK and its components
   */
  public async beforeApplicationShutdown(): Promise<void> {
    await this.sdk.shutdown()
  }
}
