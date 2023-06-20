import fs from 'node:fs'
import path from 'node:path'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { Resource, envDetector, hostDetectorSync } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { containerDetector } from '@opentelemetry/resource-detector-container'
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
import { ExceptionFilterInjector } from './trace/injectors/exception-filter.injector'

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
    ExceptionFilterInjector,
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
  resourceDetectors: [containerDetector, hostDetectorSync, envDetector],
  textMapPropagator: new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(),
    ],
  }),
}
