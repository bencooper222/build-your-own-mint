// this is absolutely not safe for general use.
class AccountMappingHolder {
  constructor(baseObj) {
    this.baseObj = baseObj;
    this.accessTracker = {};

    for (let [key] of Object.entries(baseObj)) {
      this.accessTracker[key] = 0;
    }
  }

  get(key) {
    this.accessTracker[key]++;
    const rtn = this.baseObj[key];
    return rtn == null ? -1 : rtn;
  }

  getUncalledKeys() {
    return Object.entries(this.accessTracker)
      .filter(([, val]) => {
        return val === 0;
      })
      .map(([key]) => [key, this.baseObj[key]]);
  }
}

module.exports = { AccountMappingHolder };
