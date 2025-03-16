import type { ModuleMetadata, Type } from '@nestjs/common'
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node'
import type { MetricType } from './open-telemetry.enums'
import type { Injector } from './trace/injectors'

// Backend-agnostic request type
export interface GenericRequest {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
  body?: any
  query?: Record<string, any>
  params?: Record<string, any>
  [key: string]: any
}

// Prometheus exporter interface that matches the actual OpenTelemetry implementation
export interface PrometheusExporterInterface {
  collect: () => Promise<{
    resourceMetrics: any
    errors: unknown[] // Updated to match actual PrometheusExporter type
  }>
  setPrefix?: (prefix: string) => void
  setMetricProducer: (metricProducer: any) => void
  shutdown: () => void
}

export interface PrometheusSerializerInterface {
  serialize: (resourceMetrics: any) => string
}

export interface MetricsOptions {
  enabled?: boolean
  endpoint?: string
  controller?: boolean
  prefix?: string
  defaultLabels?: Record<string, string>
  authentication?: (req: GenericRequest) => boolean
}

export interface MetricDecoratorOptions {
  name: string
  type: MetricType
  description?: string
  unit?: string
  attributes?: Record<string, string>
  valueAttributes?: string[]
}

export interface OpenTelemetryModuleConfig
  extends Partial<NodeSDKConfiguration> {
  autoInjectors?: Type<Injector>[]
  injectorsConfig?: {
    [injectorName: string]: unknown
  }
  metrics?: MetricsOptions
}

export interface OpenTelemetryModuleAsyncOption
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) =>
    | Promise<Partial<OpenTelemetryModuleConfig>>
    | Partial<OpenTelemetryModuleConfig>
  inject?: any[]
}
