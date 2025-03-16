import type { DynamicModule, FactoryProvider, ValueProvider } from '@nestjs/common'
import type { Injector } from './trace/injectors'
import { MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PrometheusExporter, PrometheusSerializer } from '@opentelemetry/exporter-prometheus'
import { Resource } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { createMetricsController } from './metrics/controller/metrics.controller'
import { UniversalHttpMetricsMiddleware } from './metrics/middleware/universal-http-metrics.middleware'
import {
  defaultConfig,
} from './open-telemetry.constants'
import { SDK_CONFIG, SDK_INJECTORS } from './open-telemetry.enums'
import {
  OpenTelemetryModuleAsyncOption,
  OpenTelemetryModuleConfig,
  PrometheusExporterInterface,
  PrometheusSerializerInterface,
} from './open-telemetry.interface'

import { OpenTelemetryService } from './open-telemetry.service'

export class OpenTelemetryModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // eslint-disable-next-line ts/no-unused-expressions
    consumer
    // .apply(UniversalHttpMetricsMiddleware)
    // .forRoutes('*')
  }

  public static forRoot(
    config: Partial<OpenTelemetryModuleConfig> = {},
  ): DynamicModule {
    config.resource = defaultConfig.resource?.merge(config.resource ?? new Resource({}))
    config = { ...defaultConfig, ...config }
    const injectors = config?.autoInjectors ?? []
    if (!config.instrumentations)
      config.instrumentations = getNodeAutoInstrumentations()

    // Set up providers array
    const providers: any = [
      ...injectors,
      OpenTelemetryService,
      this.buildProvider(config),
      this.buildInjectors(config),
      {
        provide: SDK_CONFIG,
        useValue: config,
      },
    ]

    // Configure exports
    const exports = [
      OpenTelemetryService,
    ]

    // Set up controllers array if metrics controller is enabled
    const controllers: any[] = []
    if (config.metrics?.enabled) {
      const metricsExporter: PrometheusExporterInterface = new PrometheusExporter({
        preventServerStart: true,
        prefix: config.metrics?.prefix || '',
      })
      const serializer: PrometheusSerializerInterface = new PrometheusSerializer()
      providers.push(UniversalHttpMetricsMiddleware)
      // Add the exporter provider
      providers.push({
        provide: 'PROMETHEUS_EXPORTER',
        useValue: metricsExporter,
      })
      providers.push({
        provide: 'PROMETHEUS_SERIALIZER',
        useValue: serializer,
      })
      // // Add the exporter setup factory
      // providers.push({
      //   provide: 'METRICS_EXPORTER_SETUP',
      //   useFactory: (service: OpenTelemetryService, exporter: PrometheusExporterInterface) => {
      //     service.setMetricsExporter(exporter)
      //   },
      //   inject: [OpenTelemetryService, 'PROMETHEUS_EXPORTER'],
      // })
      if (config.metrics?.controller) {
        // Add the metrics controller with configured path
        const metricsPath = config.metrics?.endpoint?.startsWith('/')
          ? config.metrics.endpoint.substring(1)
          : config.metrics.endpoint || 'metrics'
        controllers.push(createMetricsController(metricsPath))
      }
    }
    else {
      providers.push({
        provide: 'PROMETHEUS_EXPORTER',
        useValue: {
          collect: async () => ({
            resourceMetrics: { resource: {}, scopeMetrics: [] },
            errors: [] as unknown[],
          }),
          setPrefix: (_unused: string) => { /* no-op */ },
          setMetricProducer: () => {},
          shutdown: () => {},
        },
      })
      providers.push({
        provide: 'PROMETHEUS_SERIALIZER',
        useValue: {
          serialize: async () => (''),
        },
      })
    }

    return {
      global: true,
      module: OpenTelemetryModule,
      imports: [],
      controllers,
      providers,
      exports,
    }
  }

  private static buildProvider(
    configuration?: Partial<OpenTelemetryModuleConfig>,
  ): ValueProvider {
    const sdk = new NodeSDK(configuration)
    sdk.start()
    return {
      provide: NodeSDK,
      useValue: sdk,
    }
  }

  private static buildInjectors(
    configuration?: Partial<OpenTelemetryModuleConfig>,
  ): FactoryProvider {
    const injectors = configuration?.autoInjectors ?? []
    return {
      provide: SDK_INJECTORS,
      useFactory: (...injectors: Injector[]) => {
        for (const injector of injectors) {
          if (injector['inject'])
            injector.inject()
        }
      },
      inject: [
        ...injectors,
      ],
    }
  }

  public static forRootAsync(
    configuration: OpenTelemetryModuleAsyncOption,
  ): DynamicModule {
    return {
      global: true,
      module: OpenTelemetryModule,
      imports: [...(configuration?.imports ?? [])],
      providers: [
        OpenTelemetryService,
        // UniversalHttpMetricsMiddleware,
        this.buildAsyncProvider(),
        this.buildAsyncInjectors(),
        {
          provide: SDK_CONFIG,
          useFactory: configuration.useFactory,
          inject: configuration.inject,
        },
        {
          provide: 'PROMETHEUS_EXPORTER',
          useFactory: (config: OpenTelemetryModuleConfig) => {
            if (config.metrics?.enabled) {
              // Create with preventServerStart true to prevent HTTP server
              return new PrometheusExporter({
                preventServerStart: true,
                prefix: config.metrics?.prefix || '',
              })
            }
            else {
              return {
                collect: async () => ({
                  resourceMetrics: { resource: {}, scopeMetrics: [] },
                  errors: [] as unknown[],
                }),
                setPrefix: (_unused: string) => { /* no-op */ },
                setMetricProducer: () => {},
                shutdown: () => {},
              }
            }
          },
          inject: [SDK_CONFIG],
        },
        {
          provide: 'PROMETHEUS_SERIALIZER',
          useFactory: (config: OpenTelemetryModuleConfig) => {
            if (config.metrics?.enabled) {
              return new PrometheusSerializer()
            }
            else {
              return {
                serialize: async () => (''),
              }
            }
          },
          inject: [SDK_CONFIG],
        },
      ],
      controllers: [],
      exports: [OpenTelemetryService],
    }
  }

  private static buildAsyncProvider(): FactoryProvider {
    return {
      provide: NodeSDK,
      useFactory: (config: OpenTelemetryModuleConfig) => {
        config.resource = defaultConfig.resource?.merge(config.resource ?? new Resource({}))
        Object.assign(config, { ...defaultConfig, ...config })
        if (!config.instrumentations)
          config.instrumentations = getNodeAutoInstrumentations()

        const sdk = new NodeSDK(config)
        sdk.start()
        return sdk
      },
      inject: [SDK_CONFIG],
    }
  }

  private static buildAsyncInjectors(): FactoryProvider {
    return {
      provide: SDK_INJECTORS,
      useFactory: async (config: OpenTelemetryModuleConfig, moduleRef: ModuleRef) => {
        config = { ...defaultConfig, ...config }
        const injectors
          = config.autoInjectors
          ?? defaultConfig.autoInjectors!

        for (const injector of injectors) {
          const created = await moduleRef.create(injector)
          if (created['inject'])
            created.inject()
        }

        return {}
      },
      inject: [SDK_CONFIG, ModuleRef],
    }
  }
}
