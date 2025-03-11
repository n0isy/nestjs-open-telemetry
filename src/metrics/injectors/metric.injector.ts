import type { Meter } from '@opentelemetry/api'
import type { MetricDecoratorOptions } from '../../open-telemetry.interface'
import { Injectable } from '@nestjs/common'
import { MetadataScanner, ModulesContainer } from '@nestjs/core'
import { METRIC_METADATA, METRIC_METADATA_ACTIVE, MetricAttributeNames, MetricType } from '../../open-telemetry.enums'
import { OpenTelemetryService } from '../../open-telemetry.service'
import { BaseInjector } from '../../trace/injectors/base.injector'

/**
 * Injector for processing methods decorated with metric decorators.
 * Processes classes to wrap methods with metric collection logic.
 */
@Injectable()
export class MetricInjector extends BaseInjector {
  protected override readonly metadataScanner = new MetadataScanner()
  private meter: Meter

  constructor(
    protected override readonly modulesContainer: ModulesContainer,
    private readonly openTelemetryService: OpenTelemetryService,
  ) {
    super(modulesContainer)
    this.meter = this.openTelemetryService.getMeter()
  }

  /**
   * Main injection method to process all controllers and providers
   * looking for metric decorators.
   */
  public inject(): void {
    // Process controllers
    for (const controller of this.getControllers()) {
      this.processClass(controller.instance, {
        className: controller.metatype.name,
        isController: true,
      })
    }

    // Process providers
    for (const provider of this.getProviders()) {
      if (provider.instance && typeof provider.instance === 'object') {
        this.processClass(provider.instance as Record<string, any>, {
          className: provider.metatype?.name || 'UnknownProvider',
          isProvider: true,
        })
      }
    }
  }

  /**
   * Process a class instance looking for metric decorators.
   */
  private processClass(
    instance: Record<string, any>,
    options: {
      className: string
      isController?: boolean
      isProvider?: boolean
    },
  ): void {
    if (!instance)
      return

    // Scan all methods in the class
    this.metadataScanner.scanFromPrototype(
      instance,
      Object.getPrototypeOf(instance),
      (methodKey) => {
        // Get the method reference
        const methodRef = instance[methodKey]

        // Check if it has metric metadata
        if (Reflect.hasMetadata(METRIC_METADATA, methodRef)) {
          // Get the metric options from metadata
          const metricOptions: MetricDecoratorOptions & { methodName: string }
            = Reflect.getMetadata(METRIC_METADATA, methodRef)

          // Wrap the method with metric collection
          instance[methodKey] = this.wrapWithMetric(
            methodRef,
            metricOptions,
            {
              ...options,
              methodName: methodKey,
            },
          )
        }
      },
    )
  }

  /**
   * Wrap a method with metric collection logic based on its type.
   */
  private wrapWithMetric(
    methodRef: Function,
    metricOptions: MetricDecoratorOptions & { methodName: string },
    contextInfo: {
      className: string
      methodName: string
      isController?: boolean
      isProvider?: boolean
    },
  ): Function {
    // Create default attributes
    const defaultAttributes: Record<string, string> = {
      ...(metricOptions.attributes || {}),
    }

    // Add class and method information
    if (contextInfo.isController) {
      defaultAttributes[MetricAttributeNames.CONTROLLER] = contextInfo.className
      defaultAttributes[MetricAttributeNames.CONTROLLER_METHOD] = contextInfo.methodName
    }
    else if (contextInfo.isProvider) {
      defaultAttributes[MetricAttributeNames.PROVIDER] = contextInfo.className
      defaultAttributes[MetricAttributeNames.PROVIDER_METHOD] = contextInfo.methodName
    }

    // Create or get the metric based on its type
    const metric = this.createMetric(metricOptions)

    // Return a wrapped function with metric collection
    const wrapped = function (this: any, ...args: any[]) {
      // Prepare attributes for this invocation
      const attributes = { ...defaultAttributes }

      // Extract attributes from arguments if valueAttributes specified
      if (metricOptions.valueAttributes) {
        for (let i = 0; i < Math.min(args.length, metricOptions.valueAttributes.length); i++) {
          if (typeof args[i] === 'string' || typeof args[i] === 'number' || typeof args[i] === 'boolean') {
            attributes[metricOptions.valueAttributes[i]] = String(args[i])
          }
        }
      }

      // Handle different metric types
      switch (metricOptions.type) {
        case MetricType.COUNTER: {
          const counter = metric
          counter.add(1, attributes)
          break
        }
        case MetricType.HISTOGRAM: {
          const histogram = metric
          const startTime = performance.now()

          const result = methodRef.apply(this, args)

          // Handle promises
          if (result instanceof Promise) {
            return result.finally(() => {
              const duration = performance.now() - startTime
              histogram.record(duration, attributes)
            })
          }

          // Handle synchronous results
          const duration = performance.now() - startTime
          histogram.record(duration, attributes)
          return result
        }
        case MetricType.UP_DOWN_COUNTER: {
          const counter = metric

          // Get delta from first argument or default to 1
          const delta = typeof args[0] === 'number' ? args[0] : 1
          counter.add(delta, attributes)
          break
        }
        case MetricType.OBSERVABLE_GAUGE: {
          // For observable gauge, we register a callback to observe the value
          // when metric collection happens
          const gauge = metric
          const result = methodRef.apply(this, args)

          // If result is a number, register it as the current value
          if (typeof result === 'number') {
            gauge.record(result, attributes)
          }

          return result
        }
      }

      // For counter and up-down counter, we need to call the original method
      if (metricOptions.type === MetricType.COUNTER || metricOptions.type === MetricType.UP_DOWN_COUNTER) {
        return methodRef.apply(this, args)
      }
      // HISTOGRAM and OBSERVABLE_GAUGE are handled in their respective case blocks

      // No explicit return needed for histogram as it returns earlier
    }

    // Copy metadata from original method
    this.reDecorate(methodRef, wrapped)

    // Mark as processed
    Reflect.defineMetadata(METRIC_METADATA_ACTIVE, true, wrapped)

    return wrapped
  }

  /**
   * Create a metric based on its type and options.
   */
  private createMetric(options: MetricDecoratorOptions): any {
    const { name, type, description, unit } = options

    switch (type) {
      case MetricType.COUNTER:
        return this.meter.createCounter(name, {
          description,
          unit,
        })
      case MetricType.HISTOGRAM:
        return this.meter.createHistogram(name, {
          description,
          unit,
        })
      case MetricType.UP_DOWN_COUNTER:
        return this.meter.createUpDownCounter(name, {
          description,
          unit,
        })
      case MetricType.OBSERVABLE_GAUGE:
        return this.meter.createObservableGauge(name, {
          description,
          unit,
        })
      default:
        throw new Error(`Unsupported metric type: ${type}`)
    }
  }
}
