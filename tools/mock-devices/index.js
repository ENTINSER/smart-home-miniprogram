/**
 * 智能家居模拟设备脚本（无硬件演示专用）
 *
 * 功能：
 * 1. 每 3 秒向 smarthome/{id}/status 发布各设备状态 JSON
 * 2. 订阅 smarthome/{id}/control，执行指令后向 smarthome/{id}/ack 回执
 * 3. 设备状态在脚本内持续演化（水量消耗、洗涤倒计时等），模拟真实动态
 *
 * 运行：npm install && npm start
 * 触发告警：npm run alarm:gas 或 npm run alarm:intruder（需另开终端）
 */
const mqtt = require('mqtt');

const BROKER = process.env.MQTT_URL || 'mqtt://localhost:1883';

// ===== 设备状态（与小程序 utils/devices.js 对应） =====
const devices = {
  gas_valve: { open: false },
  door_lock: { locked: true },
  camera: { online: true, detecting: false },
  aircon: { power: 'off', temp: 26 },
  curtain: { position: 0 },
  water_dispenser: { level: 80 },
  washing_machine: { running: false, mode: '标准洗', remainMin: 0 },
  dishwasher: { running: false, remainMin: 0 },
};

// ===== 状态演化：让数据"动起来" =====
function evolve() {
  // 饮水机缓慢消耗，低于 5% 自动"换水"
  const wd = devices.water_dispenser;
  wd.level = wd.level <= 5 ? 100 : Math.max(0, wd.level - Math.random() * 0.4);
  wd.level = Math.round(wd.level * 10) / 10;

  // 洗衣机/洗碗机倒计时
  ['washing_machine', 'dishwasher'].forEach((id) => {
    const d = devices[id];
    if (d.running) {
      d.remainMin = Math.max(0, d.remainMin - 0.05); // 每 3 秒扣 3 秒
      if (d.remainMin <= 0) {
        d.running = false;
        d.remainMin = 0;
      }
    }
  });

  // 摄像头偶发"检测到移动"（低概率，纯演示氛围）
  const cam = devices.camera;
  if (!cam.detecting && Math.random() < 0.005) cam.detecting = true;
  if (cam.detecting && Math.random() < 0.3) cam.detecting = false;
}

// ===== 控制指令处理 =====
function applyControl(id, action, value) {
  const d = devices[id];
  if (!d) return false;

  switch (id) {
    case 'aircon':
      if (action === 'power') d.power = value;
      if (action === 'set_temp') d.temp = Math.min(30, Math.max(16, Number(value)));
      return true;
    case 'curtain':
      if (action === 'set_position') d.position = Math.min(100, Math.max(0, Number(value)));
      return true;
    case 'gas_valve':
      if (action === 'set_open') d.open = Boolean(value);
      return true;
    case 'door_lock':
      if (action === 'set_locked') d.locked = Boolean(value);
      return true;
    case 'washing_machine':
      if (action === 'start') { d.running = true; d.remainMin = 45; }
      if (action === 'stop') { d.running = false; d.remainMin = 0; }
      return true;
    case 'dishwasher':
      if (action === 'start') { d.running = true; d.remainMin = 90; }
      if (action === 'stop') { d.running = false; d.remainMin = 0; }
      return true;
    default:
      return false;
  }
}

// ===== 主流程 =====
const client = mqtt.connect(BROKER, {
  clientId: `mock_devices_${Math.random().toString(16).slice(2, 10)}`,
});

client.on('connect', () => {
  console.log(`[mock] 已连接 ${BROKER}`);

  client.subscribe('smarthome/+/control', (err) => {
    if (err) console.error('[mock] 订阅控制主题失败', err);
  });

  // 定时上报
  setInterval(() => {
    evolve();
    Object.entries(devices).forEach(([id, state]) => {
      client.publish(`smarthome/${id}/status`, JSON.stringify({ ...state, _ts: Date.now() }));
    });
  }, 3000);
  console.log('[mock] 每 3 秒上报一次设备状态');
});

client.on('message', (topic, payload) => {
  const parts = topic.split('/');
  if (parts[2] !== 'control') return;
  const id = parts[1];

  let cmd;
  try {
    cmd = JSON.parse(payload.toString());
  } catch (e) {
    return;
  }

  // 模拟设备执行耗时 300ms
  setTimeout(() => {
    const ok = applyControl(id, cmd.action, cmd.value);
    client.publish(
      `smarthome/${id}/ack`,
      JSON.stringify({ reqId: cmd.reqId, ok, state: devices[id], ts: Date.now() })
    );
    console.log(`[mock] ${id} 执行 ${cmd.action}=${JSON.stringify(cmd.value)} → ${ok ? '成功' : '失败'}`);
  }, 300);
});

client.on('error', (err) => console.error('[mock] 连接错误', err.message));
