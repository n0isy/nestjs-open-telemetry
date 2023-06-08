import { Test } from '@nestjs/testing'
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { CanActivate, Controller, Get, UseGuards } from '@nestjs/common'
import request from 'supertest'
import { APP_GUARD } from '@nestjs/core'
import { GuardInjector } from '../injectors'
import { OpenTelemetryModule } from '../../open-telemetry.module'
import { Trace } from '../decorators'

describe('Tracing Guard Injector Test', () => {
  const exporter = new NoopSpanProcessor()
  const exporterSpy = jest.spyOn(exporter, 'onStart')

  const sdkModule = OpenTelemetryModule.forRoot({
    spanProcessor: exporter,
    autoInjectors: [GuardInjector],
  })

  beforeEach(() => {
    exporterSpy.mockClear()
    exporterSpy.mockReset()
  })

  it('should trace guarded controller', async () => {
    // given
    class VeyselEfendi implements CanActivate {
      canActivate() {
        return true
      }
    }

    @UseGuards(VeyselEfendi)
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
    expect(exporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Guard->HelloController.VeyselEfendi' }),
      expect.any(Object),
    )

    await app.close()
  })

  it('should trace guarded controller method', async () => {
    // given
    class VeyselEfendi implements CanActivate {
      canActivate() {
        return true
      }
    }

    @Controller('hello')
    class HelloController {
      @Get()
      @UseGuards(VeyselEfendi)

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
        name: 'Guard->HelloController.hi.VeyselEfendi',
      }),
      expect.any(Object),
    )

    await app.close()
  })

  it('should trace guarded and decorated controller method', async () => {
    // given
    class VeyselEfendi implements CanActivate {
      canActivate() {
        return true
      }
    }

    @Controller('hello')
    class HelloController {
      @Get()
      @Trace('comolokko')
      @UseGuards(VeyselEfendi)

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
        name: 'Guard->HelloController.hi.VeyselEfendi',
      }),
      expect.any(Object),
    )

    await app.close()
  })

  it('should trace global guard', async () => {
    // given
    class VeyselEfendi implements CanActivate {
      canActivate() {
        return true
      }
    }
    @Controller('hello')
    class HelloController {
      @Get()

      hi() {}
    }
    const context = await Test.createTestingModule({
      imports: [sdkModule],
      controllers: [HelloController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: VeyselEfendi,
        },
      ],
    }).compile()
    const app = context.createNestApplication()
    await app.init()

    // when
    await request(app.getHttpServer()).get('/hello').send().expect(200)

    // then
    expect(exporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Guard->Global->VeyselEfendi' }),
      expect.any(Object),
    )

    await app.close()
  })
})
