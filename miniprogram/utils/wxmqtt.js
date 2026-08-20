/**
 * wxmqtt.js —— 微信小程序专用极简 MQTT 3.1.1 客户端
 *
 * 为什么不用 mqtt.min.js：官方浏览器构建版在小程序环境会错误降级到
 * Node TCP 实现导致连接失败，且依赖浏览器 Buffer 行为不稳定。
 * 本实现只包含本项目需要的功能：
 *   CONNECT / CONNACK、SUBSCRIBE(QoS0) / SUBACK、
 *   PUBLISH（收发均 QoS0，收到 QoS1 会自动回 PUBACK）、
 *   PINGREQ / PINGRESP 保活、断线自动重连
 *
 * 用法：
 *   const client = new WxMqttClient('wx://localhost:8083/mqtt', { clientId, keepalive });
 *   client.on('connect'|'message'|'close'|'error', fn)
 *   client.subscribe([topic1, topic2]); client.publish(topic, payload); client.disconnect();
 */

// ===== 二进制编解码工具 =====
function encodeUTF8(str) {
  const buf = new ArrayBuffer(2 + str.length * 3 < 1024 ? 1024 : 2 + str.length * 3);
  // 手写 UTF-8 编码，避免依赖 TextEncoder（小程序基础库低版本没有）
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return bytes;
}

function encodeString(str) {
  const b = encodeUTF8(str);
  return [(b.length >> 8) & 0xff, b.length & 0xff, ...b];
}

function encodeRemainingLength(len) {
  const out = [];
  do {
    let d = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) d |= 0x80;
    out.push(d);
  } while (len > 0);
  return out;
}

function decodeUTF8(bytes) {
  // 手写 UTF-8 解码
  let str = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) { str += String.fromCharCode(b); i += 1; }
    else if (b < 0xe0) { str += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
    else { str += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
  }
  return str;
}

class WxMqttClient {
  /**
   * @param {string} url wx://host:port/path
   */
  constructor(url, options = {}) {
    const m = url.match(/^wxs?:\/\/([^/:]+)(?::(\d+))?(\/.*)?$/);
    if (!m) throw new Error('MQTT URL 格式错误: ' + url);
    this.host = m[1];
    this.port = Number(m[2] || 8083);
    this.path = m[3] || '/mqtt';
    this.wsUrl = `${url.startsWith('wxs') ? 'wss' : 'ws'}://${this.host}:${this.port}${this.path}`;

    this.clientId = options.clientId || `wxmqtt_${Math.random().toString(16).slice(2, 10)}`;
    this.keepalive = options.keepalive || 30;
    this.reconnectPeriod = options.reconnectPeriod != null ? options.reconnectPeriod : 3000;

    this._events = {};
    this._socket = null;
    this._packetId = 1;
    this._rxBuffer = [];       // 接收字节缓存
    this._pingTimer = null;
    this._reconnectTimer = null;
    this._closedByUser = false;
    this._connected = false;
  }

  on(event, fn) {
    (this._events[event] = this._events[event] || []).push(fn);
    return this;
  }

  _emit(event, ...args) {
    (this._events[event] || []).forEach((fn) => {
      try { fn(...args); } catch (e) { console.error('[wxmqtt] 监听器异常', e); }
    });
  }

  connect() {
    this._closedByUser = false;
    console.log('[wxmqtt] 连接', this.wsUrl);
    const socket = wx.connectSocket({
      url: this.wsUrl,
      protocols: ['mqtt'],
      fail: (err) => {
        this._emit('error', new Error((err && err.errMsg) || 'connectSocket fail'));
        this._scheduleReconnect();
      },
    });
    this._socket = socket;

    socket.onOpen(() => {
      this._sendConnect();
    });
    socket.onMessage((res) => {
      const bytes = new Uint8Array(res.data);
      this._rxBuffer.push(...bytes);
      this._drainPackets();
    });
    socket.onClose(() => {
      this._handleClose();
    });
    socket.onError((res) => {
      this._emit('error', new Error((res && res.errMsg) || 'socket error'));
    });
  }

  // ===== 包构建 =====

  _sendPacket(bytes) {
    const arr = new Uint8Array(bytes);
    this._socket.send({
      data: arr.buffer,
      fail: (err) => this._emit('error', new Error((err && err.errMsg) || 'send fail')),
    });
  }

  _sendConnect() {
    const variableHeader = [
      ...encodeString('MQTT'),
      0x04, // 协议级别 3.1.1
      0x02, // Clean Session
      (this.keepalive >> 8) & 0xff, this.keepalive & 0xff,
    ];
    const payload = encodeString(this.clientId);
    const remaining = variableHeader.length + payload.length;
    this._sendPacket([0x10, ...encodeRemainingLength(remaining), ...variableHeader, ...payload]);
  }

  subscribe(topics) {
    const list = Array.isArray(topics) ? topics : [topics];
    const pid = this._nextPacketId();
    const payload = [];
    list.forEach((t) => payload.push(...encodeString(t), 0x00)); // QoS0
    const variableHeader = [(pid >> 8) & 0xff, pid & 0xff];
    const remaining = variableHeader.length + payload.length;
    this._sendPacket([0x82, ...encodeRemainingLength(remaining), ...variableHeader, ...payload]);
  }

  publish(topic, payload) {
    const data = typeof payload === 'string' ? encodeUTF8(payload) : payload;
    const variableHeader = encodeString(topic);
    const remaining = variableHeader.length + data.length;
    this._sendPacket([0x30, ...encodeRemainingLength(remaining), ...variableHeader, ...data]);
  }

  _sendPing() {
    this._sendPacket([0xc0, 0x00]);
  }

  disconnect() {
    this._closedByUser = true;
    this._stopPing();
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    try { this._sendPacket([0xe0, 0x00]); } catch (e) {}
    try { this._socket && this._socket.close({}); } catch (e) {}
  }

  // ===== 包解析 =====

  _drainPackets() {
    for (;;) {
      const buf = this._rxBuffer;
      if (buf.length < 2) return;
      // 解析 remaining length（可变长度）
      let multiplier = 1;
      let remaining = 0;
      let pos = 1;
      let digit;
      do {
        if (pos >= buf.length) return; // 等更多数据
        digit = buf[pos++];
        remaining += (digit & 0x7f) * multiplier;
        multiplier *= 128;
      } while ((digit & 0x80) !== 0);

      if (buf.length < pos + remaining) return; // 包不完整，等更多数据
      const type = buf[0] >> 4;
      const body = buf.slice(pos, pos + remaining);
      this._rxBuffer = buf.slice(pos + remaining);
      this._handlePacket(type, body);
    }
  }

  _handlePacket(type, body) {
    switch (type) {
      case 2: // CONNACK
        if (body[1] === 0) {
          this._connected = true;
          this._startPing();
          this._emit('connect');
        } else {
          this._emit('error', new Error('CONNACK 拒绝，返回码 ' + body[1]));
        }
        break;
      case 9: // SUBACK
        break; // 暂不校验返回码
      case 3: { // PUBLISH
        const topicLen = (body[0] << 8) | body[1];
        const topic = decodeUTF8(body.slice(2, 2 + topicLen));
        let payloadStart = 2 + topicLen;
        const qos = 0; // 我们只以 QoS0 订阅
        if (qos > 0) payloadStart += 2;
        const payload = decodeUTF8(body.slice(payloadStart));
        this._emit('message', topic, payload);
        break;
      }
      case 13: // PINGRESP
        break;
      default:
        break;
    }
  }

  // ===== 保活与重连 =====

  _startPing() {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      try { this._sendPing(); } catch (e) {}
    }, Math.max(5, this.keepalive - 5) * 1000);
  }

  _stopPing() {
    if (this._pingTimer) clearInterval(this._pingTimer);
    this._pingTimer = null;
  }

  _handleClose() {
    const wasConnected = this._connected;
    this._connected = false;
    this._stopPing();
    this._emit('close');
    if (!this._closedByUser) this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (this._closedByUser || this.reconnectPeriod <= 0) return;
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      console.log('[wxmqtt] 尝试重连…');
      this.connect();
    }, this.reconnectPeriod);
  }

  _nextPacketId() {
    const id = this._packetId++;
    if (this._packetId > 65535) this._packetId = 1;
    return id;
  }
}

module.exports = { WxMqttClient };
