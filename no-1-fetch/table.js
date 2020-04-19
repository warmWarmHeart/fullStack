import axios  from 'axios';
import {policyStatus}  from './status';
const { CancelToken } = axios;

export const source = CancelToken.source();

class CancelTable {
    defaultPolicy = policyStatus.first;

    groupTable = {};

    cancelTokenTable = {};

    firstCancelKeyTable = {};

    url2GroupIdMap = {};

    cancelKey2UrlMap = {};

    setCancelToken = (key, value) => {
        this.cancelTokenTable[key] = value;
    };
    getCancelToken = (key) => {
        return this.cancelTokenTable[key];
    };
    deleteCancelToken(key) {
        this.cancelTokenTable.delete(key);
    }

    setGroupInGroupTable(groupId, url, cancelKey) {
        if(!this.groupTable[groupId]) {
            this.groupTable[groupId] = {url: [cancelKey]}
        } if (!this.groupTable[groupId][url]){
            this.groupTable[groupId][url] = [cancelKey]
        } else if (!this.groupTable[groupId][url].includes(cancelKey)) {
            this.groupTable[groupId][url].push(cancelKey);
        }
    }
    deleteCancelKeyFromGroupTable(cancelKey) {
        const url = this.getCancelKeyUrl(cancelKey);
        const groupId = this.getUrlGroupId(url);
        const list = this.groupTable[groupId][url];
        if(groupId && list && list.key) {
            this.groupTable[groupId][url] = list.filter(item => item !== cancelKey);
            if (!this.groupTable[groupId][url].length) {
                this.groupTable[groupId].delete(url);
                this.deleteUrlGroupIdItem(url);
            }
            if(Object.keys(this.groupTable[groupId]).length) {
                this.groupTable.delete(groupId)
            }
        }
    };

    cancelKeyUrlMapping(cancelKey, url) {
        this.cancelKey2UrlMap[cancelKey] = url;
    }
    getCancelKeyUrl(cancelKey) {
        return this.cancelKey2UrlMap[cancelKey];
    }
    deleteCancelKeyUrlItem(cancelKey){
        this.cancelKey2UrlMap.delete(cancelKey);
    }

    urlGroupIdMapMapping(url, groupId) {
        this.url2GroupIdMap[url] = groupId;
    }
    getUrlGroupId(url){
        return this.url2GroupIdMap[url];
    }
    deleteUrlGroupIdItem(url){
        this.url2GroupIdMap.delete(url);
    }

    setFirstCancelKeyInTable(url, cancelKey) {
        if (!this.firstCancelKeyTable[url]) {
            this.firstCancelKeyTable[url] = cancelKey;
        }
    }
    getFirstCancelKeyFromTable(url) {
        return this.firstCancelKeyTable[url];
    }
    deleteFirstCancelKeyOfTable(url) {
        this.firstCancelKeyTable.delete(url);
    }
}


class Ajax extends CancelTable{

    static getKey(url, config) {
        if ( toString.call(url) === '[object Object]') {
            return config.url;
        } else if(toString.call(config) === '[object Object]') {
            return url;
        } else {
            return url;
        }
    }

    static initCancelToken(key, timeStamp, groupId) {
        const source = CancelToken.source();
        const cancelKey = key + timeStamp;
        this.setFirstCancelKeyInTable(key, cancelKey);
        this.setCancelToken(cancelKey, source);
        this.cancelKeyUrlMapping(cancelKey, key);
        if (groupId) {
            this.setGroupInGroupTable(groupId, key, cancelKey);
            this.urlGroupIdMapMapping(url, groupId);
        }
        return source
    }

    static getNewUrl({url,cancelKey, cancelTokenPolicy, source, timeStamp}) {
        if (typeof url === 'string') {
            return url
        } else if (toString.call(url) === '[object Object]') {
            const cancelTokenKey = cancelKey + timeStamp;
            return {
                ...url,
                cancelToken: source.token,
                cancelTokenKey,
                cancelTokenPolicy,
            }
        } else {
            return url;
        }
    }
    static getNewConfig({url,cancelKey,cancelTokenPolicy, config, source, timeStamp}) {
        const cancelTokenKey = cancelKey + timeStamp;
        if (toString.call(url) === '[object Object]') {
            return null;
        } else if (toString.call(config) === '[object Object]') {
            return {
                ...config,
                cancelToken: source.token,
                cancelTokenKey,
                cancelTokenPolicy,
            }
        } else {
            return {
                cancelToken: source.token,
                cancelTokenKey,
                cancelTokenPolicy,
            }
        }
    }

    static requestAbortEvent(config) {
        const {cancelTokenKey, url, cancelTokenPolicy} = config;
        switch(cancelTokenPolicy){
            case policyStatus.first:
                if(this.getFirstCancelKeyFromTable(url) !== cancelTokenKey){
                    const source = this.getCancelToken(cancelTokenKey);
                    source.abort();
                    this.deleteTableCache(cancelTokenKey);
                }
                break;
            case policyStatus.latest:
                const firstCancelKey = this.getFirstCancelKeyFromTable(url);
                if(firstCancelKey !== cancelTokenKey){
                    const source = this.getCancelToken(firstCancelKey);
                    source.abort();
                    this.deleteTableCache(firstCancelKey);
                }
                break;
            case policyStatus.all:
                break;
        }
    };

    static deleteTableCache(cancelKey) {
        this.deleteCancelToken(cancelKey);
        this.deleteCancelKeyUrlItem(cancelKey);
        this.deleteCancelKeyFromGroupTable(cancelKey);
    }

    setRequestInterceptor (successFn, errorFn) {
        axios.interceptors.request.use((config) => {
            this.requestAbortEvent();
            return successFn(config)
        }, (error) => {
            return errorFn(error)
        });
    }

    setResponseInterceptor (successFn, errorFn) {
        // "响应" 拦截器即异常处理
        axios.interceptors.response.use((response) => {
            return successFn(response);
        }, (error) => {
            return errorFn(error)
        });
    }


    ajax(asyncFn) {
        return function (ajaxConfig) {
            // 这里得加cancelToken
            return function (url, config) {
                // 时间戳
                const timeStamp = new Date();
                // 将url和data合为唯一的cancelKey
                const cancelKey = Ajax.getKey(url, config);
                /**
                 * ajaxConfig: {
                 *     policy: 用来设定该请求是希望保留第一次请求(first)还是当前最新请求(latest)或者是保留全部请求(all), 默认保留第一次请求取消重复请求
                 *     groupId: 用来统一取消某些请求
                 * }
                 * */
                const cancelTokenPolicy = ajaxConfig.policy || this.defaultPolicy;
                // source是用来设置取消请求的source的
                const source = this.initCancelToken(cancelKey, timeStamp, ajaxConfig.groupId);
                return asyncFn(this.getNewUrl({ url, cancelKey,cancelTokenPolicy, source, timeStamp }), this.getNewConfig({url, cancelKey, cancelTokenPolicy, config, source, timeStamp}));
            }
        }
    }
}

export default new Ajax();
