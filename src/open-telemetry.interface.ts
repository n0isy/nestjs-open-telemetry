import type { ModuleMetadata, Type } from '@nestjs/common'
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node'
import type { Injector } from './trace/injectors'

export interface OpenTelemetryModuleConfig
  extends Partial<NodeSDKConfiguration> {
  autoInjectors?: Type<Injector>[]
  injectorsConfig?: {
    [injectorName: string]: unknown
  }
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
