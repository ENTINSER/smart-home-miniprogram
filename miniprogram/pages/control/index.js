const mqtt = require('../../utils/mqtt');
const alarmUtil = require('../../utils/alarm');
const { getDevice, summarize } = require('../../utils/devices');

Page({
  data: {
    device: null,
    state: null,
    summary: '',
    sending: false, // FR-10：发送中微状态
    activeAlarm: null,
    tempRange: [16, 30],
  },

  onLoad(options) {
    const device = getDevice(options.id);
    if (!device) {
      wx.showToast({ title: '未知设备', icon: 'none' });
      return;
    }
    this.deviceId = device.id;

    this._onStatus = (id) => {
      if (id === this.deviceId) this.refresh();
    };
    this._onAlarm = (alarm) => alarmUtil.fire(alarm);
    mqtt.on('status', this._onStatus);
    mqtt.on('alarm', this._onAlarm);

    this.setData({
      device,
      tempRange: device.tempRange || [16, 30],
    });
    wx.setNavigationBarTitle({ title: device.name });
    this.refresh();
  },

  onUnload() {
    mqtt.off('status', this._onStatus);
    mqtt.off('alarm', this._onAlarm);
  },

  onShow() {
    this.setData({ activeAlarm: getApp().globalData.activeAlarm });
  },

  onAlarmFired(alarm) {
    this.setData({ activeAlarm: alarm });
  },

  onAlarmModalClose() {
    this.setData({ activeAlarm: null });
  },

  refresh() {
    const state = getApp().globalData.deviceStates[this.deviceId] || this.data.device.defaultState;
    this.setData({ state, summary: summarize(this.deviceId, state) });
  },

  /**
   * 统一控制入口：发送中 → 成功/失败（FR-10）
   */
  async control(action, value) {
    if (this.data.sending) return;
    this.setData({ sending: true });
    wx.showLoading({ title: '发送中', mask: true });
    try {
      const ack = await mqtt.sendControl(this.deviceId, action, value);
      wx.hideLoading();
      if (ack.ok) {
        wx.showToast({ title: '操作成功', icon: 'success' });
      } else {
        wx.showToast({ title: '设备未响应', icon: 'error' });
      }
    } finally {
      this.setData({ sending: false });
    }
  },

  // ===== 空调 =====
  onAirconPower(e) {
    this.control('power', e.detail.value ? 'on' : 'off');
  },
  onTempChange(e) {
    this.control('set_temp', e.detail.value);
  },
  onTempChanging(e) {
    // 拖动过程实时显示，不发送
    this.setData({ 'state.temp': e.detail.value });
  },

  // ===== 窗帘 =====
  onCurtainOpen() {
    this.control('set_position', 100);
  },
  onCurtainClose() {
    this.control('set_position', 0);
  },
  onCurtainSlide(e) {
    this.control('set_position', e.detail.value);
  },

  // ===== 天然气阀门 =====
  onGasClose() {
    wx.showModal({
      title: '确认关闭天然气阀门？',
      content: '关闭后灶具将无法使用',
      confirmColor: '#e5484d',
      success: (res) => {
        if (res.confirm) this.control('set_open', false);
      },
    });
  },
  onGasOpen() {
    this.control('set_open', true);
  },

  // ===== 门锁 =====
  onLock() {
    this.control('set_locked', true);
  },
  onUnlock() {
    wx.showModal({
      title: '确认开锁？',
      confirmColor: '#e5484d',
      success: (res) => {
        if (res.confirm) this.control('set_locked', false);
      },
    });
  },

  // ===== 洗衣机 / 洗碗机 =====
  onStartWash() {
    this.control('start', true);
  },
  onStopWash() {
    this.control('stop', true);
  },
});
