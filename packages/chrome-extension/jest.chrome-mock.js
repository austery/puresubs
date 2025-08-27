// Mock Chrome APIs for testing
global.chrome = {
  runtime: {
    onInstalled: {
      addListener: jest.fn()
    },
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn(),
    lastError: null
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  downloads: {
    download: jest.fn(),
    onChanged: {
      addListener: jest.fn()
    }
  },
  scripting: {
    executeScript: jest.fn()
  },
  tabs: {
    onUpdated: {
      addListener: jest.fn()
    },
    query: jest.fn(),
    update: jest.fn()
  }
};