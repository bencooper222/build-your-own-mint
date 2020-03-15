interface SecretAccountMapping {
  [key: string]: string;
}

// this is absolutely not safe for general use.
export class AccountMappingHolder {
  baseObj: SecretAccountMapping;
  accessTracker: { [key: string]: number };

  constructor(baseObj: SecretAccountMapping) {
    this.baseObj = baseObj;
    this.accessTracker = {};

    for (let [key] of Object.entries(baseObj)) {
      this.accessTracker[key] = 0;
    }
  }

  get(key: string) {
    this.accessTracker[key]++;
    const rtn = this.baseObj[key];

    // this will be used to index the alphabet - just need a non alphabetic character
    return rtn == null ? '1' : rtn;
  }

  getUncalledKeys() {
    return Object.entries(this.accessTracker)
      .filter(([, val]) => {
        return val === 0;
      })
      .map(([key]) => [key, this.baseObj[key]]);
  }
}
