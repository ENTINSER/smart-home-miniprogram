/**
 * 告警调度（FR-07 / FR-08 / FR-09）
 *
 * 演示阶段：小程序内全屏弹窗 + 振动 + 提示音
 * 预留：正式推送阶段在云函数 pushAlarm 中调用订阅消息接口
 */
const config = require('../config/index');

// 每类告警最近一次触发时间（客户端限频，FR-09）
const lastFiredAt = {};

function shouldFire(alarmType) {
  const now = Date.now();
  const last = lastFiredAt[alarmType] || 0;
  if (now - last < config.ALARM_COOLDOWN_MS) return false;
  lastFiredAt[alarmType] = now;
  return true;
}

const ALARM_TEXT = {
  gas: { title: '天然气泄漏警报', msg: '检测到天然气浓度异常，请立即关闭阀门并开窗通风！' },
  intruder: { title: '外人闯入警报', msg: '监控检测到陌生人进入，请立即查看监控画面！' },
};

function fire(alarm) {
  const type = alarm && alarm.type;
  if (!ALARM_TEXT[type]) return;
  if (!shouldFire(type)) return;

  const app = getApp();
  app.globalData.activeAlarm = { type, ts: Date.now(), ...ALARM_TEXT[type] };

  // 振动 + 提示音
  wx.vibrateLong({ fail: () => {} });
  try {
    const audio = wx.createInnerAudioContext();
    audio.src = '/assets/alarm.wav';
    audio.loop = false;
    audio.play();
    audio.onEnded(() => audio.destroy());
    audio.onError(() => audio.destroy());
  } catch (e) {}

  // 通知所有页面刷新告警条
  getCurrentPages().forEach((page) => {
    if (typeof page.onAlarmFired === 'function') page.onAlarmFired(app.globalData.activeAlarm);
  });
}

function dismiss() {
  getApp().globalData.activeAlarm = null;
}

module.exports = { fire, dismiss, ALARM_TEXT };
