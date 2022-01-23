import {Db} from 'mongodb';

export interface User<ID> {
  id: ID;
  username: string;
  password: string;
  contact: string;
}
export interface Collections {
  user: string;
  password: string;
  history: string;
}
export interface CollectionsConfig {
  user: string;
  password?: string;
  history?: string;
}
export interface FieldConfig {
  contact?: string;
  username?: string;
  password?: string;
  history?: string;
  changedTime?: string;
  failCount?: string;
}
export function initCollections(c: CollectionsConfig): Collections {
  const co: Collections = {user: c.user, password: c.user, history: c.user};
  if (c.password && c.password.length > 0) {
    co.password = c.password;
  }
  co.history = (c.history && c.history.length > 0 ? c.history : co.password);
  return co;
}
export function useRepository<ID>(db: Db, c: CollectionsConfig, max?: number, fields?: FieldConfig): Repository<ID> {
  const conf = initCollections(c);
  if (fields) {
    return new Repository<ID>(db, conf, fields.contact, fields.username, fields.password, fields.history, fields.changedTime, fields.failCount, max);
  } else {
    return new Repository<ID>(db, conf, undefined, undefined, undefined, undefined, undefined, undefined, max);
  }
}
export const usePasswordRepository = useRepository;
export const useMongoPasswordRepository = useRepository;
export class Repository<ID> {
  max: number;
  contact: string;
  username: string;
  password: string;
  history: string;
  constructor(
    public db: Db,
    public collections: Collections,
    contact?: string,
    username?: string,
    password?: string,
    history?: string,
    public changedTime?: string,
    public failCount?: string,
    max?: number,
  ) {
    this.max = (max !== undefined ? max : 8);
    this.username = (username && username.length > 0 ? username : 'username');
    this.contact = (contact && contact.length > 0 ? contact : 'email');
    this.password = (password && password.length > 0 ? password : 'password');
    this.history = (history && history.length > 0 ? history : 'history');
    this.getUser = this.getUser.bind(this);
    this.update = this.update.bind(this);
    this.getHistory = this.getHistory.bind(this);
  }
  getUser(userNameOrEmail: string, exludePassword?: boolean): Promise<User<ID>> {
    const query = {
      $or: [
        {[this.username]: userNameOrEmail},
        {[this.contact]: userNameOrEmail}
      ]
    };
    return this.db.collection(this.collections.user).findOne(query).then((obj: { [x: string]: any; _id: any; }) => {
      const user: any = {
        ['id']: obj['_id'],
        ['username']: obj[this.username],
        ['contact']: obj[this.contact],
        ['password']: obj[this.password],
      };
      if (exludePassword || this.collections.user === this.collections.password) {
        return user;
      } else {
        const query2 = {_id : obj._id};
        return this.db.collection(this.collections.password).findOne(query2).then((pass: { [x: string]: any; }) => {
          user['password'] = pass[this.password];
          return user;
        });
      }
    });
  }
  update(userId: ID, newPassword: string, oldPassword?: string): Promise<number> {
    const pass: any = {
      _id: userId,
      [this.password]: newPassword,
    };
    if (this.changedTime && this.changedTime.length > 0) {
      pass[this.changedTime] = new Date();
    }
    if (this.failCount && this.failCount.length > 0) {
      pass[this.failCount] = 0;
    }
    const query = {_id : userId};
    const p = new Promise<number>(((resolve, reject) => {
      this.db.collection(this.collections.password).findOneAndUpdate(query, { $set: pass }, {
        upsert: true
      }, (err: any, res: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(getAffectedRow(res));
        }
      });
    }));
    const history = this.history;
    if (oldPassword && history) {
      return this.db.collection(this.collections.history).findOne(query).then((his: { [x: string]: string[]; }) => {
        let h2: string[] = [oldPassword];
        if (his) {
          h2 = his[history];
          if (h2) {
            h2.push(oldPassword);
          }
          while (h2.length > this.max) {
            h2.shift();
          }
        }
        if (this.collections.password === this.collections.history) {
          pass[history] = h2;
          return p;
        } else {
          const models = {
            _id: userId,
            [history]: h2
          };
          return p.then(res => {
            return new Promise<number>(((resolve, reject) => {
              this.db.collection(this.collections.history).findOneAndUpdate(query, { $set: models }, {
                upsert: true
              }, (err: any, res2: any) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(res);
                }
              });
            }));
          });
        }
      });
    } else {
      return p;
    }
  }
  getHistory(userId: ID, max?: number): Promise<string[]> {
    const history = this.history;
    if (history) {
      const query = {_id : userId};
      return this.db.collection(this.collections.history).findOne(query).then((his: { [x: string]: any; }) => {
        if (his) {
          const k = his[history];
          if (Array.isArray(k)) {
            if (max !== undefined && max > 0) {
              while (k.length > max) {
                k.shift();
              }
              return k;
            } else {
              return k as string[];
            }
          } else {
            return [];
          }
        } else {
          return [];
        }
      });
    } else {
      return Promise.resolve([]);
    }
  }
}
export const MongoRepository = Repository;
export const PasswordRepository = Repository;
export const MongoPasswordRepository = Repository;
export const Service = Repository;
export const MongoService = Repository;
export const PasswordService = Repository;
export const MongoPasswordService = Repository;
export function getAffectedRow(res: any): number {
  return res.lastErrorObject ? res.lastErrorObject.n : (res.ok ? res.ok : 0);
}
