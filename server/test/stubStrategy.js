const passport = require('passport-strategy');
const util = require('util');

// verify function --> function(token, done, [optional: additionalTokenInfo])
  // provides token [bearer token] as credential
  // finds user in posession of token
  // invokes done(err, user, info) with found user
      // if user not found, `user` = `false`
  // additionalTokenInfo is set by Passport at `req.authInfo`
      // can be used for access control; to pass token scope
function Strategy(options, verify) {
  if (typeof options === 'function') {
    verify = options;
    options = {};
  }
  if (!verify) { throw new TypeError('HTTPBearerStrategy requires a verify callback'); }

  passport.Strategy.call(this);
  this.name = 'bearer';
  this._verify = verify;
  this._realm = options.realm || 'Users';
  if (options.scope) {
    this._scope = (Array.isArray(options.scope)) ? options.scope : [ options.scope ];
  }
  this._passReqToCallback = options.passReqToCallback;
}

util.inherits(Strategy, passport.Strategy);

Strategy.prototype.authenticate = function(req) {
  var token;
  
  if (req.headers && req.headers.authorization) {
    var parts = req.headers.authorization.split(' ');
    if (parts.length == 2) {
      var scheme = parts[0]
        , credentials = parts[1];
        
      if (/^Bearer$/i.test(scheme)) {
        token = credentials;
      }
    } else {
      return this.fail(400);
    }
  }

  if (req.body && req.body.access_token) {
    if (token) { return this.fail(400); }
    token = req.body.access_token;
  }

  if (req.query && req.query.access_token) {
    if (token) { return this.fail(400); }
    token = req.query.access_token;
  }
  
  if (!token) { return this.fail(this._challenge()); }
  
  var self = this;
  
  function verified(err, user, info) {
    if (err) { return self.error(err); }
    if (!user) {
      if (typeof info == 'string') {
        info = { message: info }
      }
      info = info || {};
      return self.fail(self._challenge('invalid_token', info.message));
    }
    self.success(user, info);
  }
  
  if (self._passReqToCallback) {
    this._verify(req, token, verified);
  } else {
    this._verify(token, verified);
  }
};

Strategy.prototype._challenge = function(code, desc, uri) {
  var challenge = 'Bearer realm="' + this._realm + '"';
  if (this._scope) {
    challenge += ', scope="' + this._scope.join(' ') + '"';
  }
  if (code) {
    challenge += ', error="' + code + '"';
  }
  if (desc && desc.length) {
    challenge += ', error_description="' + desc + '"';
  }
  if (uri && uri.length) {
    challenge += ', error_uri="' + uri + '"';
  }
  
  return challenge;
};

module.exports = Strategy;