//Disable logging

const log  = {
  error: function(...args: any[]) {
    // console.error(...args);
  },
  warn: function(...args: any[]) {
    // console.warn(...args);
  },
  info: function(...args: any[]) {
    // console.info(...args);
  },
  debug: function(...args: any[]) {
    // console.log(...args);
  }
};

export default log;
