/**
 * 告警触发器（演示用）
 *
 * 用法：
 *   node trigger-alarm.js gas       → 模拟天然气泄漏
 *   node trigger-alarm.js intruder  → 模拟外人闯入
 *
 * 小程序端收到 smarthome/alarm 消息后弹出全屏告警（FR-07/FR-08）
 */
const mqtt = require('mqtt');

const BROKER = process.env.MQTT_URL || 'mqtt://localhost:1883';
const type = process.argv[2];

const SCENARIOS = {
  gas: { type: 'gas', level: 'critical', source: 'gas_sensor_kitchen' },
  intruder: { type: 'intruder', level: 'critical', source: 'camera_living_room' },
};

if (!SCENARIOS[type]) {
  console.error('用法: node trigger-alarm.js <gas|intruder>');
  process.exit(1);
}

const client = mqtt.connect(BROKER);
client.on('connect', () => {
  const alarm = { ...SCENARIOS[type], ts: Date.now() };
  client.publish('smarthome/alarm', JSON.stringify(alarm), { qos: 1 }, () => {
    console.log(`[alarm] 已触发「${type}」告警`);
    client.end();
    process.exit(0);
  });
});
client.on('error', (err) => {
  console.error('[alarm] 连接失败', err.message);
  process.exit(1);
});
