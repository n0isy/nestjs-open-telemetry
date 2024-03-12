import { Test } from '@nestjs/testing'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import {
  Controller,
  Get,
  Injectable,
  Module,
} from '@nestjs/common'
import request from 'supertest'
import { ControllerInjector, DecoratorInjector, ProviderInjector } from '../injectors'
import { OpenTelemetryModule } from '../../open-telemetry.module'
import { Trace } from '../decorators'

describe('tracing provider injector test', () => {
  const exporter = new NoopSpanProcessor()
  const exporterSpy = jest.spyOn(exporter, 'onStart')

  beforeEach(() => {
    exporterSpy.mockClear()
    exporterSpy.mockReset()
  })

  it('should trace test service', async () => {
    @Injectable()
    class TestService {
      async hi() {
        this.test()
        return ''
      }

      @Trace('SLM_CNM')
      test() {
        return ''
      }
    }
    @Injectable()
    @Trace()
    class HelloService {
      constructor(
      ) {}

      hi() {
        return ''
      }
    }
    @Controller('hello')
    class HelloController {
      constructor(
        private testService: TestService,
        private helloService: HelloService,
      ) {}

      @Get()
      hi() {
        this.helloService.hi()
        return this.testService.hi()
      }
    }
    const context = await Test.createTestingModule({
      imports: [
        OpenTelemetryModule.forRoot({
          spanProcessors: [exporter],
          autoInjectors: [DecoratorInjector, ControllerInjector, ProviderInjector],
        }),
      ],
      controllers: [HelloController],
      providers: [TestService, HelloService],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello').send().expect(200)

    // then
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(4)
    expect(spans[0].name).toStrictEqual('Controller -> HelloController.hi')
    expect(spans[1].name).toStrictEqual('Provider -> HelloService.hi')
    expect(spans[2].name).toStrictEqual('Provider -> TestService.hi')
    expect(spans[3].name).toStrictEqual('Provider -> TestService.SLM_CNM')

    await app.close()
  })

  it('should trace test service and exclude modules', async () => {
    @Injectable()
    class ExcludeModuleService {
      hi() {
        return ''
      }
    }
    @Module({
      providers: [ExcludeModuleService],
      exports: [ExcludeModuleService],
    })
    class ExcludedModule {}
    @Injectable()
    class ExcludeService {
      hi() {
        return ''
      }
    }
    @Injectable()
    class TestService {
      async hi() {
        this.test()
        return ''
      }

      @Trace('SLM_CNM')
      test() {
        return ''
      }
    }
    @Injectable()
    @Trace()
    class HelloService {
      constructor(
      ) {}

      hi() {
        return ''
      }
    }
    @Controller('hello')
    class HelloController {
      constructor(
        private testService: TestService,
        private helloService: HelloService,
        private excludedService: ExcludeService,
        private excludeModuleService: ExcludeModuleService,
      ) {}

      @Get()
      hi() {
        this.helloService.hi()
        this.excludedService.hi()
        this.excludeModuleService.hi()
        return this.testService.hi()
      }
    }
    const context = await Test.createTestingModule({
      imports: [
        OpenTelemetryModule.forRoot({
          spanProcessor: exporter,
          autoInjectors: [DecoratorInjector, ControllerInjector, ProviderInjector],
          injectorsConfig: {
            ProviderInjector: {
              excludeProviders: [ExcludeService],
              excludeModules: [ExcludedModule],
            },
          },
        }),
        ExcludedModule,
      ],
      controllers: [HelloController],
      providers: [TestService, ExcludeService, HelloService],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello').send().expect(200)

    // then
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(4)
    expect(spans[0].name).toStrictEqual('Controller -> HelloController.hi')
    expect(spans[1].name).toStrictEqual('Provider -> HelloService.hi')
    expect(spans[2].name).toStrictEqual('Provider -> TestService.hi')
    expect(spans[3].name).toStrictEqual('Provider -> TestService.SLM_CNM')

    await app.close()
  })
})
