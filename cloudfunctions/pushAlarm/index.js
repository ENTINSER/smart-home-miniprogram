/**
 * 告警推送云函数（预留，正式推送阶段启用）
 *
 * 注意：
 * 1. 个人主体小程序只支持「一次性订阅消息」：用户每授权一次只能推送一条
 * 2. 模板：设备报警通知（o5E_ThqAtqpXgOL73YI7AaaXrpM-XRnkrTpHvrxn_Uw）
 * 3. 云函数内调用 cloud.openapi 不需要 AppSecret
 * 4. 触发链路：EMQX 规则引擎 Webhook / 常驻脚本 → HTTP 触发本函数
 *    （云函数不能常驻 MQTT 连接，不要在函数内订阅 Broker）
 *
 * 模板字段需与公众平台后台实际模板的关键词对齐后再填 data
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const TEMPLATE_ID = 'o5E_ThqAtqpXgOL73YI7AaaXrpM-XRnkrTpHvrxn_Uw';

exports.main = async (event) => {
  const { openid, alarmType, deviceName } = event;
  if (!openid) return { ok: false, error: 'missing openid' };

  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: TEMPLATE_ID,
      page: 'pages/index/index',
      // 字段名以实际模板关键词为准，以下为示例占位
      data: {
        thing1: { value: (deviceName || '家居设备').slice(0, 20) },
        thing2: { value: (alarmType === 'gas' ? '天然气泄漏' : '外人闯入').slice(0, 20) },
        time3: { value: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) },
      },
    });
    return { ok: true };
  } catch (err) {
    // errCode 43101 = 用户未订阅/订阅次数已用完（一次性订阅的常态）
    return { ok: false, error: err.errMsg || String(err) };
  }
};
