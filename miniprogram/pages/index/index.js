const mqtt = require('../../utils/mqtt');
const alarmUtil = require('../../utils/alarm');
const { DEVICES, summarize } = require('../../utils/devices');

Page({
  data: {
    connected: false,
    safetyDevices: [],   // 安全类设备置顶（FR-02）
    normalDevices: [],
    activeAlarm: null,
  },

  onLoad() {
    this._onStatus = () => this.renderDevices();
    this._onConn = (connected) => this.setData({ connected });
    this._onAlarm = (alarm) => alarmUtil.fire(alarm);

    mqtt.on('status', this._onStatus);
    mqtt.on('conn', this._onConn);
    mqtt.on('alarm', this._onAlarm);

    this.setData({ connected: getApp().globalData.mqttConnected });
    this.renderDevices();
  },

  onUnload() {
    mqtt.off('status', this._onStatus);
    mqtt.off('conn', this._onConn);
    mqtt.off('alarm', this._onAlarm);
  },

  onShow() {
    this.setData({ activeAlarm: getApp().globalData.activeAlarm });
    this.renderDevices();
  },

  // 告警触发回调（alarm.js 会调用所有当前页面的 onAlarmFired）
  onAlarmFired(alarm) {
    this.setData({ activeAlarm: alarm });
  },

  onAlarmModalClose() {
    this.setData({ activeAlarm: null });
  },

  renderDevices() {
    const states = getApp().globalData.deviceStates;
    const decorate = (d) => {
      const state = states[d.id];
      return {
        ...d,
        summary: summarize(d.id, state),
        // 安全设备异常态：用于红闪
        danger:
          (d.id === 'gas_valve' && state && state.open) ||
          (d.id === 'door_lock' && state && !state.locked) ||
          (d.id === 'camera' && state && (!state.online || state.detecting)),
      };
    };
    this.setData({
      safetyDevices: DEVICES.filter((d) => d.safety).map(decorate),
      normalDevices: DEVICES.filter((d) => !d.safety).map(decorate),
    });
  },

  goControl(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/control/index?id=${id}` });
  },
});
