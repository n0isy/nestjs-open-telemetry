import type { OpenTelemetryModuleConfig } from './open-telemetry.interface'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { CompositePropagator, W3CTraceContextPropagator } from '@opentelemetry/core'
import { containerDetector } from '@opentelemetry/resource-detector-container'
import { envDetector, hostDetectorSync, Resource } from '@opentelemetry/resources'
import { SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { MetricInjector } from './metrics/injectors'
import {
  ControllerInjector,
  DecoratorInjector,
  GuardInjector,
  InterceptorInjector,
  LoggerInjector,
  MiddlewareInjector,
  PipeInjector,
  ProviderInjector,
  ScheduleInjector,
  TypeormInjector,
} from './trace/injectors'
import { ExceptionFilterInjector } from './trace/injectors/exception-filter.injector'

const version: string | undefined = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')).version
  }
  catch {}
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
    MetricInjector,
  ],
  autoDetectResources: true,
  contextManager: new AsyncLocalStorageContextManager(),
  resource: new Resource({
    [SEMRESATTRS_SERVICE_VERSION]: version ?? 'unknown',
  }),
  resourceDetectors: [containerDetector, hostDetectorSync, envDetector],
  textMapPropagator: new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(),
    ],
  }),
  metrics: {
    enabled: false,
    controller: true,
    endpoint: '/metrics',
    prefix: '',
  },
}
