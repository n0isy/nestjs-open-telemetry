import { Controller, ForbiddenException, Get } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import request from 'supertest'
import waitForExpect from 'wait-for-expect'
import { OpenTelemetryModule } from '../../open-telemetry.module'
import { Trace } from '../decorators'
import { ControllerInjector, DecoratorInjector } from '../injectors'

describe('tracing controller injector test', () => {
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

  it('should trace controller method', async () => {
    // given
    @Controller('hello')
    class HelloController {
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
    await waitForExpect(() =>
      expect(exporterSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Controller -> HelloController.hi' }),
        expect.any(Object),
      ),
    )

    await app.close()
  })

  it('should trace controller method exception', async () => {
    // given
    @Controller('hello')
    class HelloController {
      @Get()
      hi() {
        throw new ForbiddenException()
      }
    }

    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello').send().expect(403)

    // then
    await waitForExpect(() =>
      expect(exporterSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Controller -> HelloController.hi',
          status: {
            code: 2,
            message: 'Forbidden',
          },
        }),
        expect.any(Object),
      ),
    )

    await app.close()
  })

  it('should not trace controller method if there is no path', async () => {
    // given
    @Controller('hello')
    class HelloController {
      hi() {}
    }

    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
    }).compile()
    const app = context.createNestApplication()
    await app.init()
    const helloController = app.get(HelloController)

    // when
    helloController.hi()

    // then
    await waitForExpect(() =>
      expect(exporterSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Controller -> HelloController.hi' }),
        expect.any(Object),
      ),
    )

    await app.close()
  })

  it('should not trace controller method if already decorated', async () => {
    // given
    @Controller('hello')
    class HelloController {
      @Get()
      @Trace('SLM_CNM')
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
    await waitForExpect(() =>
      expect(exporterSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Controller -> HelloController.SLM_CNM',
        }),
        expect.any(Object),
      ),
    )

    await app.close()
  })
})
