/**
 * MQTT 连接层（小程序端）
 *
 * 使用 mqtt.js 浏览器构建版（libs/mqtt.min.js），通过 wx:// 协议
 * 底层调用 wx.connectSocket，开发者工具勾选「不校验合法域名」后可连本机 Broker
 */
const mqttLib = require('../libs/mqtt.min.js');
const config = require('../config/index');
const { TOPIC, DEVICES } = require('./devices');

let client = null;
const listeners = {
  status: new Set(),   // (deviceId, state) => {}
  alarm: new Set(),    // (alarm) => {}
  conn: new Set(),     // (connected) => {}
  ack: new Set(),      // (deviceId, ack) => {}
};

function connect() {
  if (client) return client;

  client = mqttLib.connect(config.MQTT_URL, {
    clientId: `miniprogram_${Math.random().toString(16).slice(2, 10)}`,
    keepalive: 30,
    reconnectPeriod: 3000,
    connectTimeout: 5000,
  });

  client.on('connect', () => {
    getApp().globalData.mqttConnected = true;
    // 订阅所有设备状态、回执与告警主题
    const topics = [TOPIC.alarm];
    DEVICES.forEach((d) => {
      topics.push(TOPIC.status(d.id));
      topics.push(TOPIC.ack(d.id));
    });
    client.subscribe(topics, (err) => {
      if (err) console.error('[mqtt] 订阅失败', err);
    });
    emit('conn', true);
  });

  client.on('message', (topic, payload) => {
    let data;
    try {
      data = JSON.parse(payload.toString());
    } catch (e) {
      return;
    }
    if (topic === TOPIC.alarm) {
      emit('alarm', data);
      return;
    }
    const parts = topic.split('/');
    const deviceId = parts[1];
    const kind = parts[2];
    if (kind === 'status') {
      getApp().globalData.deviceStates[deviceId] = data;
      emit('status', deviceId, data);
    } else if (kind === 'ack') {
      emit('ack', deviceId, data);
    }
  });

  client.on('close', () => {
    getApp().globalData.mqttConnected = false;
    emit('conn', false);
  });
  client.on('error', (err) => {
    console.error('[mqtt] 连接错误', err);
  });

  return client;
}

/**
 * 下发控制指令，等待回执（FR-10：发送中 → 成功/失败）
 * @returns Promise<{ ok: boolean, state?: object }>
 */
function sendControl(deviceId, action, value) {
  return new Promise((resolve) => {
    const reqId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const timer = setTimeout(() => {
      off('ack', handler);
      resolve({ ok: false, error: 'timeout' });
    }, config.CONTROL_TIMEOUT_MS);

    const handler = (id, ack) => {
      if (id === deviceId && ack && ack.reqId === reqId) {
        clearTimeout(timer);
        off('ack', handler);
        resolve(ack);
      }
    };
    on('ack', handler);

    client.publish(
      TOPIC.control(deviceId),
      JSON.stringify({ reqId, action, value, ts: Date.now() })
    );
  });
}

function on(type, fn) {
  listeners[type].add(fn);
}
function off(type, fn) {
  listeners[type].delete(fn);
}
function emit(type, ...args) {
  listeners[type].forEach((fn) => {
    try {
      fn(...args);
    } catch (e) {
      console.error('[mqtt] 监听器异常', e);
    }
  });
}

module.exports = { connect, sendControl, on, off };
