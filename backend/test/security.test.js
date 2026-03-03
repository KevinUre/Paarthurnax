const { registerSecurityHooks } = require("../src/security");

describe('security hooks', () => {
  let appMock;
  let request;
  let reply;

  beforeEach(async () => {
    appMock = {
      callbacks: [],
      addHook: (hook, handler) => {
        appMock.callbacks.push(handler)
      },
      onRequest: async (req, rep) => {
        await appMock.callbacks.forEach(async(cb)=>{
          await cb(req,rep)
        })
      }
    }
    request = {
      headers: {},
      method: "GET",
    }
    reply = {
      _headers: {},
      header: (key, val) => { reply._headers[key] = val },
      _code: 0,
      _send: jest.fn(),
      code: (num) => {
        reply._code = num;
        return { send: (any) => { return reply._send(any)}}
      }
    }
  });
  afterEach(() => {
    jest.resetAllMocks();
    appMock = null;
    request = null;
    reply = null
  });

  describe('CORS', () => {
    it('403 on bad origin', async () => {
      let config = {
        corsEnabled: true,
        cspEnabled: false,
        corsAllowLocalhost: false,
        corsOriginList:["https://example.site"]
      }
      request.headers['origin'] = "http://badmen.ru";

      registerSecurityHooks(appMock,config);
      await appMock.onRequest(request,reply);

      expect(reply._code).toBe(403);
    })

    it('Correct Headers on allowed origin', async () => {
      let config = {
        corsEnabled: true,
        cspEnabled: false,
        corsAllowLocalhost: false,
        corsOriginList:["https://example.site"]
      }
      request.headers['origin'] = "https://example.site";

      registerSecurityHooks(appMock,config);
      await appMock.onRequest(request,reply);

      expect(reply._headers["Access-Control-Allow-Origin"]).toBe("https://example.site");
      expect(reply._headers["Access-Control-Allow-Headers"]).toBe("Content-Type, Authorization");
    })

    it('Correct Headers on * allowed', async () => {
      let config = {
        corsEnabled: true,
        cspEnabled: false,
        corsAllowLocalhost: false,
        corsOriginList:["*"]
      }
      request.headers['origin'] = "https://example.site";

      registerSecurityHooks(appMock,config);
      await appMock.onRequest(request,reply);

      expect(reply._headers["Access-Control-Allow-Origin"]).toBe("*");
      expect(reply._headers["Access-Control-Allow-Headers"]).toBe("Content-Type, Authorization");
    })

    it('* on disabled', async () => {
      let config = {
        corsEnabled: false,
        cspEnabled: false,
        corsAllowLocalhost: false,
        corsOriginList:["https://example.site"]
      }
      request.headers['origin'] = "http://badmen.ru";

      registerSecurityHooks(appMock,config);
      await appMock.onRequest(request,reply);

      expect(reply._headers["Access-Control-Allow-Origin"]).toBe("*");
      expect(reply._headers["Access-Control-Allow-Headers"]).toBe("Content-Type, Authorization");
    })

    it('local dev okay', async () => {
      let config = {
        corsEnabled: true,
        cspEnabled: false,
        corsAllowLocalhost: true,
        corsOriginList:["https://example.site"]
      }
      request.headers['origin'] = "https://localhost:5173";

      registerSecurityHooks(appMock,config);
      await appMock.onRequest(request,reply);

      expect(reply._headers["Access-Control-Allow-Origin"]).toBe("https://localhost:5173");
      expect(reply._headers["Access-Control-Allow-Headers"]).toBe("Content-Type, Authorization");
    })
  });

  describe('CSP', () => {
    it('adds correct headers', async () => {
      let config = {
        corsEnabled: false,
        cspEnabled: true,
        corsAllowLocalhost: false,
        cspConnectSrc: ["'self'", 'https://api.example.site']
      }

      registerSecurityHooks(appMock,config);
      await appMock.onRequest(request,reply);

      const actual = reply._headers["Content-Security-Policy"]
      expect(actual).toMatch("default-src 'self'");
      expect(actual).toMatch("connect-src 'self' https://api.example.site");
    })
  })
});
