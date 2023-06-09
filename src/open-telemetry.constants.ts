import fs from 'node:fs'
import path from 'node:path'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { Resource, hostDetectorSync, processDetectorSync } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { containerDetector } from '@opentelemetry/resource-detector-container'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { CompositePropagator, W3CTraceContextPropagator } from '@opentelemetry/core'
import {
  ControllerInjector,
  GuardInjector,
  InterceptorInjector, LoggerInjector, MiddlewareInjector,
  PipeInjector, ProviderInjector,
  ScheduleInjector, TypeormInjector,
} from './trace/injectors'
import { OpenTelemetryModuleConfig } from './open-telemetry.interface'

export enum OpenTelemetryConstants {
  SDK_CONFIG = 'OPEN_TELEMETRY_SDK_CONFIG',
  SDK_INJECTORS = 'SDK_INJECTORS',
  TRACE_METADATA = 'OPEN_TELEMETRY_TRACE_METADATA',
  TRACE_METADATA_ACTIVE = 'OPEN_TELEMETRY_TRACE_METADATA_ACTIVE',
}

export enum AttributeNames {
  MODULE = 'nestjs.module',
  PROVIDER = 'nestjs.provider',
  PROVIDER_SCOPE = 'nestjs.provider.scope',
  PROVIDER_METHOD = 'nestjs.provider.method',
  INJECTOR = 'nestjs.injector',
  CONTROLLER = 'nestjs.controller',
  PIPE = 'nestjs.pipe',
  INTERCEPTOR = 'nestjs.interceptor',
  GUARD = 'nestjs.guard',
  MIDDLEWARE = 'nestjs.middleware',
  SCOPE = 'nestjs.scope',
}

export enum ProviderScope {
  REQUEST = 'REQUEST',
  TRANSIENT = 'TRANSIENT',
  DEFAULT = 'DEFAULT',
}

export enum NestScope {
  CONTROLLER = 'CONTROLLER',
  METHOD = 'METHOD',
  GLOBAL = 'GLOBAL',
}

const version: string | undefined = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')).version
  }
  catch (e) {}
})()

export const defaultConfig: OpenTelemetryModuleConfig = {
  serviceName: 'UNKNOWN',
  autoInjectors: [
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
  resourceDetectors: [containerDetector, hostDetectorSync, processDetectorSync],
  spanProcessor: new NoopSpanProcessor(),
  textMapPropagator: new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(),
    ],
  }),
}
