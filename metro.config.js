const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.headers.accept && req.headers.accept.includes('multipart/mixed')) {
        req.headers.accept = 'application/javascript';
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
