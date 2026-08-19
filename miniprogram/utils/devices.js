/**
 * 设备模型定义
 *
 * safety: true 的设备在首页置顶并以红标显示（FR-02）
 * topic 规范：
 *   状态上报  smarthome/{id}/status   （模拟脚本 → 小程序）
 *   控制下发  smarthome/{id}/control  （小程序 → 模拟脚本）
 *   控制回执  smarthome/{id}/ack      （模拟脚本 → 小程序）
 *   告警      smarthome/alarm         （模拟脚本 → 小程序）
 */

const DEVICES = [
  {
    id: 'gas_valve',
    name: '天然气阀门',
    safety: true,
    desc: '厨房燃气总阀',
    defaultState: { open: false },
  },
  {
    id: 'door_lock',
    name: '智能门锁',
    safety: true,
    desc: '入户门',
    defaultState: { locked: true },
  },
  {
    id: 'camera',
    name: '监控摄像头',
    safety: true,
    desc: '客厅',
    defaultState: { online: true, detecting: false },
  },
  {
    id: 'aircon',
    name: '空调',
    safety: false,
    desc: '卧室',
    defaultState: { power: 'off', temp: 26 },
    tempRange: [16, 30],
  },
  {
    id: 'curtain',
    name: '窗帘',
    safety: false,
    desc: '客厅落地窗',
    defaultState: { position: 0 }, // 0=全关 100=全开
  },
  {
    id: 'water_dispenser',
    name: '饮水机',
    safety: false,
    desc: '厨房',
    defaultState: { level: 80 }, // 剩余水量 %
  },
  {
    id: 'washing_machine',
    name: '洗衣机',
    safety: false,
    desc: '阳台',
    defaultState: { running: false, mode: '标准洗', remainMin: 0 },
  },
  {
    id: 'dishwasher',
    name: '洗碗机',
    safety: false,
    desc: '厨房',
    defaultState: { running: false, remainMin: 0 },
  },
];

const TOPIC = {
  status: (id) => `smarthome/${id}/status`,
  control: (id) => `smarthome/${id}/control`,
  ack: (id) => `smarthome/${id}/ack`,
  alarm: 'smarthome/alarm',
};

function getDevice(id) {
  return DEVICES.find((d) => d.id === id);
}

/**
 * 把设备状态格式化为首页卡片上的一行摘要文本
 */
function summarize(id, state) {
  if (!state) return '等待数据…';
  switch (id) {
    case 'gas_valve':
      return state.open ? '阀门开启中' : '已关闭';
    case 'door_lock':
      return state.locked ? '已上锁' : '未上锁';
    case 'camera':
      if (!state.online) return '离线';
      return state.detecting ? '检测到移动' : '监控中';
    case 'aircon':
      return state.power === 'on' ? `运行中 · ${state.temp}℃` : '已关机';
    case 'curtain':
      if (state.position === 0) return '全关';
      if (state.position === 100) return '全开';
      return `开度 ${state.position}%`;
    case 'water_dispenser':
      return `剩余水量 ${state.level}%`;
    case 'washing_machine':
      return state.running ? `${state.mode} · 剩余 ${state.remainMin} 分钟` : '待机';
    case 'dishwasher':
      return state.running ? `洗涤中 · 剩余 ${state.remainMin} 分钟` : '待机';
    default:
      return '';
  }
}

module.exports = { DEVICES, TOPIC, getDevice, summarize };
