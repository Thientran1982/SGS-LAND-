import { afterEach, describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import {
  attachSocketIoAdapterHealth,
  getSocketIoAdapterHealth,
  markSocketIoAdapterConnecting,
  markSocketIoAdapterInMemory,
} from '../services/socketIoAdapterHealth';

class FakeRedisClient extends EventEmitter {
  status = 'connecting';
}

describe('Socket.IO Redis adapter health', () => {
  afterEach(() => {
    markSocketIoAdapterInMemory();
  });

  it('requires both Redis clients before enabling distributed room delivery', () => {
    const publisher = new FakeRedisClient();
    const subscriber = new FakeRedisClient();
    markSocketIoAdapterConnecting();
    attachSocketIoAdapterHealth(publisher, subscriber);

    expect(getSocketIoAdapterHealth()).toMatchObject({
      status: 'degraded',
      distributed: false,
      broadcastAvailable: false,
    });

    publisher.status = 'ready';
    publisher.emit('ready');
    expect(getSocketIoAdapterHealth()).toMatchObject({
      status: 'degraded',
      distributed: false,
      broadcastAvailable: false,
    });

    subscriber.status = 'ready';
    subscriber.emit('ready');
    expect(getSocketIoAdapterHealth()).toMatchObject({
      status: 'healthy',
      distributed: true,
      broadcastAvailable: true,
      publisherStatus: 'ready',
      subscriberStatus: 'ready',
    });

    publisher.status = 'end';
    publisher.emit('close');
    expect(getSocketIoAdapterHealth()).toMatchObject({
      status: 'degraded',
      distributed: false,
      broadcastAvailable: false,
    });

    publisher.status = 'ready';
    publisher.emit('ready');
    expect(getSocketIoAdapterHealth()).toMatchObject({
      status: 'healthy',
      distributed: true,
      broadcastAvailable: true,
    });
  });
});