import type { DynamicModule, FactoryProvider, ValueProvider } from '@nestjs/common'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ModuleRef } from '@nestjs/core'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { Resource } from '@opentelemetry/resources'
import { OpenTelemetryService } from './open-telemetry.service'
import {
  OpenTelemetryConstants,
  defaultConfig,
} from './open-telemetry.constants'
import type { Injector } from './trace/injectors'
import type { OpenTelemetryModuleAsyncOption, OpenTelemetryModuleConfig } from './open-telemetry.interface'

export class OpenTelemetryModule {
  public static forRoot(
    config: Partial<OpenTelemetryModuleConfig> = {},
  ): DynamicModule {
    config.resource = defaultConfig.resource?.merge(config.resource ?? new Resource({}))
    config = { ...defaultConfig, ...config }
    const injectors = config?.autoInjectors ?? []
    if (!config.instrumentations)
      config.instrumentations = getNodeAutoInstrumentations()

    return {
      global: true,
      module: OpenTelemetryModule,
      imports: [],
      providers: [
        ...injectors,
        OpenTelemetryService,
        this.buildProvider(config),
        this.buildInjectors(config),
        {
          provide: OpenTelemetryConstants.SDK_CONFIG,
          useValue: config,
        },
      ],
      exports: [],
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
      provide: OpenTelemetryConstants.SDK_INJECTORS,
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
        this.buildAsyncProvider(),
        this.buildAsyncInjectors(),
        {
          provide: OpenTelemetryConstants.SDK_CONFIG,
          useFactory: configuration.useFactory,
          inject: configuration.inject,
        },
      ],
      exports: [],
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
      inject: [OpenTelemetryConstants.SDK_CONFIG],
    }
  }

  private static buildAsyncInjectors(): FactoryProvider {
    return {
      provide: OpenTelemetryConstants.SDK_INJECTORS,
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
      inject: [OpenTelemetryConstants.SDK_CONFIG, ModuleRef],
    }
  }
}
