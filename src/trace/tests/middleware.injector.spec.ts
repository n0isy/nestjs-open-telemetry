import type {
  MiddlewareConsumer,
  NestMiddleware,
  NestModule,
} from '@nestjs/common'
import {
  Controller,
  Get,
  Injectable,
  Module,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import request from 'supertest'
import { OpenTelemetryModule } from '../../open-telemetry.module'
import { TracePlain } from '../decorators'
import {
  ControllerInjector,
  MiddlewareInjector,
} from '../injectors'

describe('tracing middleware injector test', () => {
  const exporter = new NoopSpanProcessor()
  const exporterSpy = jest.spyOn(exporter, 'onStart')

  const sdkModule = OpenTelemetryModule.forRoot({
    spanProcessors: [exporter],
    autoInjectors: [MiddlewareInjector, ControllerInjector],
  })

  beforeEach(() => {
    exporterSpy.mockClear()
    exporterSpy.mockReset()
  })

  it('should trace test middleware', async () => {
    @Injectable()
    class TestMiddleware implements NestMiddleware {
      use(_req: any, _res: any, next: () => void) { next() }
    }
    @Controller('hello')
    class HelloController {
      @Get()
      hi() {}
    }
    @Module({
      controllers: [HelloController],
    })
    class HelloModule implements NestModule {
      configure(consumer: MiddlewareConsumer) {
        consumer.apply(TestMiddleware).forRoutes('*')
      }
    }

    const context = await Test.createTestingModule({
      imports: [sdkModule, HelloModule],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello').send().expect(200)

    // then
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(2)
    expect(spans[0].name).toStrictEqual('Middleware -> TestMiddleware')
    expect(spans[1].name).toStrictEqual('Controller -> HelloController.hi')

    await app.close()
  })
  it('should not trace test middleware', async () => {
    @Injectable()
    class TestMiddleware implements NestMiddleware {
      @TracePlain()
      use(_req: any, _res: any, next: () => void) { next() }
    }
    @Controller('hello')
    class HelloController {
      @Get()
      hi() {}
    }
    @Module({
      controllers: [HelloController],
    })
    class HelloModule implements NestModule {
      configure(consumer: MiddlewareConsumer) {
        consumer.apply(TestMiddleware).forRoutes('*')
      }
    }

    const context = await Test.createTestingModule({
      imports: [sdkModule, HelloModule],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello').send().expect(200)

    // then
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(2)
    expect(spans[0].name).toStrictEqual('Class -> TestMiddleware.use')
    expect(spans[1].name).toStrictEqual('Controller -> HelloController.hi')

    await app.close()
  })
})
