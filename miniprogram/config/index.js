/**
 * 全局配置文件
 *
 * 注意：
 * 1. 本项目不包含也不需要 AppSecret，云函数内调用微信接口走 cloud.openapi，免 access_token
 * 2. 演示阶段关闭域名校验（project.config.json 中 urlCheck: false），可用 ws:// 明文连接
 * 3. 真机调试时请把 MQTT_URL 中的 localhost 换成本机局域网 IP（如 192.168.1.100）
 */

module.exports = {
  // EMQX 本机默认 WebSocket 端口 8083，路径 /mqtt
  MQTT_URL: 'wx://localhost:8083/mqtt',

  // 同一告警的最小推送间隔（FR-09：5 分钟内不重复提醒）
  ALARM_COOLDOWN_MS: 5 * 60 * 1000,

  // 控制指令等待回执的超时时间
  CONTROL_TIMEOUT_MS: 3000,

  // 订阅消息模板 ID（预留：正式推送阶段使用，个人主体为一次性订阅）
  // 模板名称：设备报警通知
  ALARM_TEMPLATE_ID: 'o5E_ThqAtqpXgOL73YI7AaaXrpM-XRnkrTpHvrxn_Uw',

  // 云开发环境 ID（开通云开发后填写，并在 app.js 中取消 wx.cloud.init 注释）
  CLOUD_ENV_ID: '',
};
