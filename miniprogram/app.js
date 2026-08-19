const config = require('./config/index');

App({
  globalData: {
    // 设备实时状态缓存：{ [deviceId]: { ...state, _ts } }
    deviceStates: {},
    // 当前活跃告警（null 表示无）
    activeAlarm: null,
    // MQTT 连接状态
    mqttConnected: false,
  },

  onLaunch() {
    // 云开发开通后取消注释，并填入云环境 ID
    // if (wx.cloud) {
    //   wx.cloud.init({ env: config.CLOUD_ENV_ID, traceUser: true });
    // }

    const mqtt = require('./utils/mqtt');
    mqtt.connect();
  },
});
