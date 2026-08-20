const config = require('./config/index');

App({
  globalData: {
    // 设备实时状态缓存：{ [deviceId]: { ...state, _ts } }
    deviceStates: {},
    // 当前活跃告警（null 表示无）
    activeAlarm: null,
    // MQTT 连接状态
    mqttConnected: false,
    // 最近一次连接错误（用于首页错误展示）
    lastMqttError: '',
  },

  onLaunch() {
    // 云开发开通后取消注释，并填入云环境 ID
    // if (wx.cloud) {
    //   wx.cloud.init({ env: config.CLOUD_ENV_ID, traceUser: true });
    // }

    const mqtt = require('./utils/mqtt');
    try {
      console.log('[mqtt] 正在连接', config.MQTT_URL);
      mqtt.connect();
    } catch (e) {
      // 启动期同步异常（如库兼容性问题），记录并上屏
      const msg = (e && e.message) || String(e);
      console.error('[mqtt] 启动连接异常', msg, e);
      this.globalData.lastMqttError = '启动异常: ' + msg;
    }
  },
});
