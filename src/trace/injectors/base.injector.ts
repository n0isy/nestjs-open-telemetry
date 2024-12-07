import type { Controller, Injectable } from '@nestjs/common/interfaces'
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper'
import type { Attributes, Span, SpanOptions } from '@opentelemetry/api'
import type { Injector } from './injector'
import { Injectable as InjectableDec } from '@nestjs/common'
import { PATH_METADATA } from '@nestjs/common/constants'
import { MetadataScanner, ModulesContainer } from '@nestjs/core'
import { context, INVALID_SPAN_CONTEXT, SpanStatusCode, trace } from '@opentelemetry/api'
import { TRACE_METADATA, TRACE_METADATA_ACTIVE } from '../../open-telemetry.enums'

export type DynamicAttributesHook = (option: { args: unknown[], thisArg: unknown, parentSpan?: Span }) => Attributes

@InjectableDec()
export abstract class BaseInjector implements Injector {
  private static readonly PATTERN_METADATA = 'microservices:pattern'
  protected readonly metadataScanner: MetadataScanner = new MetadataScanner()

  public constructor(protected readonly modulesContainer: ModulesContainer) {}

  protected *getControllers(): Generator<InstanceWrapper<Controller>> {
    for (const module of this.modulesContainer.values()) {
      for (const controller of module.controllers.values()) {
        if (controller && controller.metatype?.prototype)
          yield controller as InstanceWrapper<Controller>
      }
    }
  }

  protected *getProviders(): Generator<InstanceWrapper<Injectable>> {
    for (const module of this.modulesContainer.values()) {
      for (const provider of module.providers.values()) {
        if (provider && provider.metatype?.prototype)
          yield provider as InstanceWrapper<Injectable>
      }
    }
  }

  protected isPath(target: object): boolean {
    return Reflect.hasMetadata(PATH_METADATA, target)
  }

  protected isPatten(target: object): boolean {
    return Reflect.hasMetadata(BaseInjector.PATTERN_METADATA, target)
  }

  protected isAffected(target: object): boolean {
    return Reflect.hasMetadata(TRACE_METADATA_ACTIVE, target)
  }

  protected isDecorated(target: object): boolean {
    return Reflect.hasMetadata(TRACE_METADATA, target)
  }

  protected reDecorate(source: object, destination: NonNullable<unknown>): void {
    const keys = Reflect.getMetadataKeys(source)

    for (const key of keys) {
      const meta = Reflect.getMetadata(key, source)
      Reflect.defineMetadata(key, meta, destination)
    }
  }

  protected wrap(
    func: Function,
    traceName: string,
    spanOptions: SpanOptions = {},
    requireParentSpan = false,
    dynamicAttributesHook?: DynamicAttributesHook,
  ): Function {
    const method = new Proxy(func, {
      apply: (target, thisArg, args: any[]) => {
        const stackObject = {}
        Error.captureStackTrace(stackObject)
        const tracer = trace.getTracer('default')
        const ctx = context.active()
        const parentSpan = trace.getSpan(ctx)
        if (requireParentSpan && (parentSpan == null || parentSpan.spanContext() === INVALID_SPAN_CONTEXT))
          return Reflect.apply(target, thisArg, args)
        const span = tracer.startSpan(
          traceName,
          spanOptions,
          ctx,
        )
        const contextWithSpan = trace.setSpan(ctx, span)
        return context.with(contextWithSpan, (currentSpan) => {
          if (dynamicAttributesHook)
            currentSpan.setAttributes(dynamicAttributesHook({ args, thisArg, parentSpan }))

          const beforeApplyStackObject = {}
          Error.captureStackTrace(beforeApplyStackObject)
          try {
            const result = Reflect.apply(target, thisArg, args)
            if (result instanceof Promise) {
              return result
                .then((res) => {
                  currentSpan.end()
                  return res
                })
                .catch(error => BaseInjector.recordException(error, [stackObject, beforeApplyStackObject], currentSpan))
            }
            currentSpan.end()
            return result
          }
          catch (error) {
            BaseInjector.recordException(error as Error, [stackObject, beforeApplyStackObject], currentSpan)
          }
        }, undefined, span)
      },
    })

    Reflect.defineMetadata(TRACE_METADATA, {
      ...spanOptions,
      name: traceName,
    }, method)
    this.affect(method)
    this.reDecorate(func, method)

    return method
  }

  protected static recordException(error: Error, [stackObject, beforeApplyStackObject]: [{ stack?: string }, { stack?: string }], span: Span): never {
    if (stackObject.stack && beforeApplyStackObject.stack) {
      const preCallSites = stackObject.stack.split('\n')
      const beforeCallSites = beforeApplyStackObject.stack.split('\n')
      const callSites = error.stack?.split('\n') ?? []
      if (callSites.length > 1) {
        const startLine = callSites.findIndex(s => s.startsWith(beforeCallSites[1].split(':')[0]))
        const endLine = callSites.findIndex(s => s.startsWith(preCallSites[1].split(':')[0]))
        if (startLine !== -1 && endLine !== -1) {
          const newCallSites = callSites.slice(0, startLine).concat(callSites.slice(endLine + 1))
          error.stack = newCallSites.join('\n')
        }
      }
    }
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
    span.end()
    throw error
  }

  protected affect(target: object): void {
    Reflect.defineMetadata(TRACE_METADATA_ACTIVE, true, target)
  }

  public abstract inject(): void
}
