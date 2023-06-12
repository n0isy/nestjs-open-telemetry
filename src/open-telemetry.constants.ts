import fs from 'node:fs'
import path from 'node:path'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { Resource, hostDetectorSync } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { containerDetector } from '@opentelemetry/resource-detector-container'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { CompositePropagator, W3CTraceContextPropagator } from '@opentelemetry/core'
import {
  ControllerInjector, DecoratorInjector,
  GuardInjector,
  InterceptorInjector,
  LoggerInjector,
  MiddlewareInjector,
  PipeInjector,
  ProviderInjector,
  ScheduleInjector,
  TypeormInjector,
} from './trace/injectors'
import { OpenTelemetryModuleConfig } from './open-telemetry.interface'

const version: string | undefined = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')).version
  }
  catch (e) {}
})()

export const defaultConfig: OpenTelemetryModuleConfig = {
  serviceName: 'UNKNOWN',
  autoInjectors: [
    DecoratorInjector,
    ScheduleInjector,
    ControllerInjector,
    GuardInjector,
    PipeInjector,
    InterceptorInjector,
    TypeormInjector,
    LoggerInjector,
    ProviderInjector,
    MiddlewareInjector,
  ],
  autoDetectResources: true,
  contextManager: new AsyncLocalStorageContextManager(),
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_VERSION]: version ?? 'unknown',
  }),
  resourceDetectors: [containerDetector, hostDetectorSync],
  spanProcessor: new NoopSpanProcessor(),
  textMapPropagator: new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(),
    ],
  }),
}
