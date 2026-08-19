/**
 * 登录云函数：获取用户 openid
 *
 * 部署：开发者工具 → 云开发控制台开通环境后，右键本目录 → 上传并部署
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  return { openid: OPENID };
};
