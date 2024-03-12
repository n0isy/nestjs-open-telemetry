import { Test } from '@nestjs/testing'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Controller, Get, Injectable } from '@nestjs/common'
import request from 'supertest'
import { Trace, TracePlain } from '../decorators'
import { OpenTelemetryModule } from '../../open-telemetry.module'
import { ControllerInjector, DecoratorInjector } from '../injectors'
import { TRACE_METADATA_ACTIVE } from '../../open-telemetry.enums'

describe('tracing decorator injector test', () => {
  const exporter = new NoopSpanProcessor()
  const exporterSpy = jest.spyOn(exporter, 'onStart')

  const sdkModule = OpenTelemetryModule.forRoot({
    spanProcessors: [exporter],
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
      TRACE_METADATA_ACTIVE,
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

  it('should trace decorated class method', async () => {
    // given
    class HelloService {
      @TracePlain()
      hi() {}
    }
    @Controller('hello')
    class HelloController {
      @Trace()
      @Get()
      hi() {
        return (new HelloService()).hi()
      }
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
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(2)
    expect(spans[0].name).toStrictEqual('Controller -> HelloController.hi')
    expect(spans[1].name).toStrictEqual('Class -> HelloService.hi')

    await app.close()
  })

  it('should trace decorated class all method', async () => {
    // given
    @TracePlain()
    class HelloService {
      hello() {}
      hi() {}
    }
    @Controller('hello')
    class HelloController {
      @Trace()
      @Get()
      hi() {
        const helloService = new HelloService()
        helloService.hello()
        return helloService.hi()
      }
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
    const spans = exporterSpy.mock.calls.map(call => call[0])
    expect(spans.length).toStrictEqual(3)
    expect(spans[0].name).toStrictEqual('Controller -> HelloController.hi')
    expect(spans[1].name).toStrictEqual('Class -> HelloService.hello')
    expect(spans[2].name).toStrictEqual('Class -> HelloService.hi')

    await app.close()
  })
})
