Component({
  properties: {
    // { title, msg, type, ts }
    alarm: { type: Object, value: null },
  },

  methods: {
    onConfirm() {
      const alarmUtil = require('../../utils/alarm');
      alarmUtil.dismiss();
      this.triggerEvent('close');
    },
  },
});
