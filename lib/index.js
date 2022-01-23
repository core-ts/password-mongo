"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function initCollections(c) {
  var co = { user: c.user, password: c.user, history: c.user };
  if (c.password && c.password.length > 0) {
    co.password = c.password;
  }
  co.history = (c.history && c.history.length > 0 ? c.history : co.password);
  return co;
}
exports.initCollections = initCollections;
function useRepository(db, c, max, fields) {
  var conf = initCollections(c);
  if (fields) {
    return new Repository(db, conf, fields.contact, fields.username, fields.password, fields.history, fields.changedTime, fields.failCount, max);
  }
  else {
    return new Repository(db, conf, undefined, undefined, undefined, undefined, undefined, undefined, max);
  }
}
exports.useRepository = useRepository;
exports.usePasswordRepository = useRepository;
exports.useMongoPasswordRepository = useRepository;
var Repository = (function () {
  function Repository(db, collections, contact, username, password, history, changedTime, failCount, max) {
    this.db = db;
    this.collections = collections;
    this.changedTime = changedTime;
    this.failCount = failCount;
    this.max = (max !== undefined ? max : 8);
    this.username = (username && username.length > 0 ? username : 'username');
    this.contact = (contact && contact.length > 0 ? contact : 'email');
    this.password = (password && password.length > 0 ? password : 'password');
    this.history = (history && history.length > 0 ? history : 'history');
    this.getUser = this.getUser.bind(this);
    this.update = this.update.bind(this);
    this.getHistory = this.getHistory.bind(this);
  }
  Repository.prototype.getUser = function (userNameOrEmail, exludePassword) {
    var _a, _b;
    var _this = this;
    var query = {
      $or: [
        (_a = {}, _a[this.username] = userNameOrEmail, _a),
        (_b = {}, _b[this.contact] = userNameOrEmail, _b)
      ]
    };
    return this.db.collection(this.collections.user).findOne(query).then(function (obj) {
      var _a;
      var user = (_a = {},
        _a['id'] = obj['_id'],
        _a['username'] = obj[_this.username],
        _a['contact'] = obj[_this.contact],
        _a['password'] = obj[_this.password],
        _a);
      if (exludePassword || _this.collections.user === _this.collections.password) {
        return user;
      }
      else {
        var query2 = { _id: obj._id };
        return _this.db.collection(_this.collections.password).findOne(query2).then(function (pass) {
          user['password'] = pass[_this.password];
          return user;
        });
      }
    });
  };
  Repository.prototype.update = function (userId, newPassword, oldPassword) {
    var _a;
    var _this = this;
    var pass = (_a = {
      _id: userId
    },
      _a[this.password] = newPassword,
      _a);
    if (this.changedTime && this.changedTime.length > 0) {
      pass[this.changedTime] = new Date();
    }
    if (this.failCount && this.failCount.length > 0) {
      pass[this.failCount] = 0;
    }
    var query = { _id: userId };
    var p = new Promise((function (resolve, reject) {
      _this.db.collection(_this.collections.password).findOneAndUpdate(query, { $set: pass }, {
        upsert: true
      }, function (err, res) {
        if (err) {
          reject(err);
        }
        else {
          resolve(getAffectedRow(res));
        }
      });
    }));
    var history = this.history;
    if (oldPassword && history) {
      return this.db.collection(this.collections.history).findOne(query).then(function (his) {
        var _a;
        var h2 = [oldPassword];
        if (his) {
          h2 = his[history];
          if (h2) {
            h2.push(oldPassword);
          }
          while (h2.length > _this.max) {
            h2.shift();
          }
        }
        if (_this.collections.password === _this.collections.history) {
          pass[history] = h2;
          return p;
        }
        else {
          var models_1 = (_a = {
            _id: userId
          },
            _a[history] = h2,
            _a);
          return p.then(function (res) {
            return new Promise((function (resolve, reject) {
              _this.db.collection(_this.collections.history).findOneAndUpdate(query, { $set: models_1 }, {
                upsert: true
              }, function (err, res2) {
                if (err) {
                  reject(err);
                }
                else {
                  resolve(res);
                }
              });
            }));
          });
        }
      });
    }
    else {
      return p;
    }
  };
  Repository.prototype.getHistory = function (userId, max) {
    var history = this.history;
    if (history) {
      var query = { _id: userId };
      return this.db.collection(this.collections.history).findOne(query).then(function (his) {
        if (his) {
          var k = his[history];
          if (Array.isArray(k)) {
            if (max !== undefined && max > 0) {
              while (k.length > max) {
                k.shift();
              }
              return k;
            }
            else {
              return k;
            }
          }
          else {
            return [];
          }
        }
        else {
          return [];
        }
      });
    }
    else {
      return Promise.resolve([]);
    }
  };
  return Repository;
}());
exports.Repository = Repository;
exports.MongoRepository = Repository;
exports.PasswordRepository = Repository;
exports.MongoPasswordRepository = Repository;
exports.Service = Repository;
exports.MongoService = Repository;
exports.PasswordService = Repository;
exports.MongoPasswordService = Repository;
function getAffectedRow(res) {
  return res.lastErrorObject ? res.lastErrorObject.n : (res.ok ? res.ok : 0);
}
exports.getAffectedRow = getAffectedRow;
