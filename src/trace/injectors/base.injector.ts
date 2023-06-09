import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper'
import { MetadataScanner, ModulesContainer } from '@nestjs/core'
import type { Controller, Injectable } from '@nestjs/common/interfaces'
import { PATH_METADATA } from '@nestjs/common/constants'
import { Injectable as InjectableDec } from '@nestjs/common'
import { INVALID_SPAN_CONTEXT, Span, SpanOptions, SpanStatusCode, context, trace } from '@opentelemetry/api'
import type { Attributes } from '@opentelemetry/api'
import { Constants } from '../../constants'
import type { Injector } from './injector'

export type DynamicAttributesHook = (option: { args: unknown[]; thisArg: unknown; parentSpan?: Span }) => Attributes

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
    return Reflect.hasMetadata(Constants.TRACE_METADATA_ACTIVE, target)
  }

  protected isDecorated(target: object): boolean {
    return Reflect.hasMetadata(Constants.TRACE_METADATA, target)
  }

  protected reDecorate(source: object, destination: Object): void {
    const keys = Reflect.getMetadataKeys(source)

    for (const key of keys) {
      const meta = Reflect.getMetadata(key, source)
      Reflect.defineMetadata(key, meta, destination)
    }
  }

  protected wrap(func: Function, traceName: string, spanOptions: SpanOptions = {}, requireParentSpan = false, dynamicAttributesHook?: DynamicAttributesHook): Function {
    const method = {
      [func.name](...args: any[]) {
        const tracer = trace.getTracer('default')
        const ctx = context.active()
        const parentSpan = trace.getSpan(ctx)
        if (requireParentSpan && (parentSpan == null || parentSpan.spanContext() === INVALID_SPAN_CONTEXT))
          return func.apply(this, args)
        const span = tracer.startSpan(
          traceName,
          spanOptions,
          ctx,
        )

        return context.with(trace.setSpan(ctx, span), (currentSpan) => {
          if (dynamicAttributesHook)
            currentSpan.setAttributes(dynamicAttributesHook({ args, thisArg: this, parentSpan }))

          try {
            const result = func.apply(this, args)
            if (result instanceof Promise) {
              return result
                .then(res => res)
                .catch(error => BaseInjector.recordException(error, currentSpan))
                .finally(() => currentSpan.end())
            }
            return result
          }
          catch (error) {
            BaseInjector.recordException(error as Error, currentSpan)
          }
          finally {
            currentSpan.end()
          }
        }, undefined, span)
      },
    }[func.name]

    Reflect.defineMetadata(Constants.TRACE_METADATA, {
      ...spanOptions,
      name: traceName,
    }, method)
    this.affect(method)
    this.reDecorate(func, method)

    return method
  }

  protected static recordException(error: Error, span: Span): never {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
    throw error
  }

  protected affect(target: object): void {
    Reflect.defineMetadata(Constants.TRACE_METADATA_ACTIVE, true, target)
  }

  public abstract inject(): void
}
