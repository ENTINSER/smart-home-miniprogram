/**
 * MQTT 连接层（小程序端）
 *
 * 底层使用自研的 wxmqtt.js（极简 MQTT 3.1.1 over wx.connectSocket）
 * 开发者工具勾选「不校验合法域名」后可连本机 Broker
 */
const { WxMqttClient } = require('./wxmqtt');
const config = require('../config/index');
const { TOPIC, DEVICES } = require('./devices');

let client = null;
const listeners = {
  status: new Set(),   // (deviceId, state) => {}
  alarm: new Set(),    // (alarm) => {}
  conn: new Set(),     // (connected, errMsg) => {}
  ack: new Set(),      // (deviceId, ack) => {}
};

function connect() {
  if (client) return client;

  client = new WxMqttClient(config.MQTT_URL, {
    keepalive: 30,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    getApp().globalData.mqttConnected = true;
    getApp().globalData.lastMqttError = '';
    // 订阅所有设备状态、回执与告警主题
    const topics = [TOPIC.alarm];
    DEVICES.forEach((d) => {
      topics.push(TOPIC.status(d.id));
      topics.push(TOPIC.ack(d.id));
    });
    client.subscribe(topics);
    emit('conn', true, '');
  });

  client.on('message', (topic, payload) => {
    let data;
    try {
      data = JSON.parse(payload);
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
    emit('conn', false, getApp().globalData.lastMqttError || '连接已断开');
  });

  client.on('error', (err) => {
    const msg = (err && (err.message || err.errMsg)) || String(err);
    console.error('[mqtt] 连接错误', msg);
    getApp().globalData.mqttConnected = false;
    getApp().globalData.lastMqttError = msg;
    emit('conn', false, msg);
  });

  client.connect();
  return client;
}

/**
 * 下发控制指令，等待回执（FR-10：发送中 → 成功/失败）
 * @returns Promise<{ ok: boolean, state?: object }>
 */
function sendControl(deviceId, action, value) {
  return new Promise((resolve) => {
    if (!client) {
      console.warn('[mqtt] 客户端未就绪，尝试重连');
      try {
        connect();
      } catch (e) {}
      resolve({ ok: false, error: 'not_connected' });
      return;
    }

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
  // 重放当前连接状态，避免页面错过启动阶段的错误事件
  if (type === 'conn') {
    const g = getApp().globalData;
    if (!g.mqttConnected && g.lastMqttError) fn(false, g.lastMqttError);
  }
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
