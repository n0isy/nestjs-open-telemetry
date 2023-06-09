import { Test } from '@nestjs/testing'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Controller, Get, Injectable } from '@nestjs/common'
import request from 'supertest'
import { Trace } from '../decorators'
import { OpenTelemetryModule } from '../../open-telemetry.module'
import { Constants } from '../../constants'
import { ControllerInjector, DecoratorInjector } from '../injectors'

describe('Tracing Decorator Injector Test', () => {
  const exporter = new NoopSpanProcessor()
  const exporterSpy = jest.spyOn(exporter, 'onStart')

  const sdkModule = OpenTelemetryModule.forRoot({
    spanProcessor: exporter,
    autoInjectors: [DecoratorInjector, ControllerInjector],
  })

  beforeEach(() => {
    exporterSpy.mockClear()
    exporterSpy.mockReset()
  })

  it('should trace decorated provider method', async () => {
    // given
    @Injectable()
    class HelloService {
      @Trace()

      hi() {}
    }
    const context = await Test.createTestingModule({
      imports: [sdkModule],
      providers: [HelloService],
    }).compile()
    const app = context.createNestApplication()
    const helloService = app.get(HelloService)

    // when
    helloService.hi()

    // then
    expect(exporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Provider -> HelloService.hi' }),
      expect.any(Object),
    )

    await app.close()
  })

  it('should trace decorated controller method', async () => {
    // given
    @Controller('hello')
    class HelloController {
      @Trace()
      @Get()

      hi() {}
    }
    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello').send().expect(200)

    // then
    expect(exporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Controller -> HelloController.hi' }),
      expect.any(Object),
    )

    await app.close()
  })

  it('should trace decorated controller method with custom trace name', async () => {
    // given
    @Controller('hello')
    class HelloController {
      @Trace('MAVI_VATAN')
      @Get()

      hi() {}
    }
    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello').send().expect(200)

    // then
    expect(exporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Controller -> HelloController.MAVI_VATAN',
      }),
      expect.any(Object),
    )

    await app.close()
  })

  it('should not trace already tracing prototype', async () => {
    // given
    @Injectable()
    class HelloService {
      @Trace()

      hi() {}
    }
    Reflect.defineMetadata(
      Constants.TRACE_METADATA_ACTIVE,
      1,
      HelloService.prototype.hi,
    )

    const context = await Test.createTestingModule({
      imports: [sdkModule],
      providers: [HelloService],
    }).compile()
    const app = context.createNestApplication()
    const helloService = app.get(HelloService)

    // when
    helloService.hi()

    // then
    expect(exporterSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Provider -> HelloService.hi' }),
      expect.any(Object),
    )

    await app.close()
  })
})
