import axios from 'axios';

const { CancelToken } = axios;
export const policyStatus = {
    first: 'first',
    latest: 'latest',
    all: 'all',
};

class Ajax {
    cancelTokenTable = {};

    defaultPolicy = policyStatus.first;

    setCancelTokenTable = (timeStamp, source) => {
        this.cancelTokenTable[timeStamp] = source;
    };

    getCancelTokenTable = (timeStamp) => {
        return this.cancelTokenTable[timeStamp];
    };

    deleteCancelTokenTable = (timeStamp) => {
        if (timeStamp) {
            delete this.cancelTokenTable[timeStamp];
        } else {
            this.cancelTokenTable = {};
        }
    };

    firstTable = {};

    setFirstTable = (key, firstTimeStamp) => {
        this.firstTable[key] = firstTimeStamp;
    };

    getFirstTable = (key) => {
        return key ? this.firstTable[key] : this.firstTable;
    };

    deleteFirstTable = (key) => {
        if (key) {
            delete this.firstTable[key];
        } else {
            this.firstTable = {};
        }
    };

    timeStampTable = {};

    setTimeStampTable = (timeStamp, key) => {
        this.timeStampTable[timeStamp] = key;
    };

    getTimeStampTable = (timeStamp) => {
        return timeStamp ? this.timeStampTable[timeStamp] : this.timeStampTable;
    };

    deleteTimeStampTable = (timeStamp) => {
        if (timeStamp) {
            delete this.timeStampTable[timeStamp];
        } else {
            this.timeStampTable = {};
        }
    };

    urlTable = {};

    setUrlTable = (key, url) => {
        this.urlTable[key] = url;
    };

    getUrlTable = (key) => {
        return key ? this.urlTable[key] : this.urlTable;
    };

    deleteUrlTable = (key) => {
        if (key) {
            delete this.urlTable[key];
        } else {
            this.urlTable = {};
        }
    };

    groupTable = {};

    setGroupTable = (url, groupId) => {
        this.groupTable[url] = groupId;
    };

    getGroupTable = (url) => {
        return url ? this.groupTable[url] : this.groupTable;
    };

    deleteGroupTable = (url) => {
        if (url) {
            delete this.groupTable[url];
        } else {
            this.groupTable = {};
        }
    };
}


class Ajax extends Ajax {
    getKey=(url, config) => {
        if (toString.call(url) === '[object Object]') {
            return config.url;
        } if (toString.call(config) === '[object Object]') {
            return url;
        }
        return url;
    };

    initCancelToken=({ groupId, url, key, timeStamp }) => {
        const source = CancelToken.source();
        if (!this.getFirstTable(key)) {
            this.setFirstTable(key, timeStamp);
        }
        this.setTimeStampTable(timeStamp, key);
        this.setUrlTable(key, url);
        // 根据时间戳存储source
        this.setCancelTokenTable(timeStamp, source);
        if (groupId && !this.getGroupTable(url)) {
            this.setGroupTable(url, groupId);
        }
        return source;
    };

    getNewUrl=({ url, cancelTokenPolicy, source, timeStamp, key }) => {
        if (typeof url === 'string') {
            return url;
        } if (toString.call(url) === '[object Object]') {
            return {
                ...url,
                cancelToken: source.token,
                actionTimeStamp: timeStamp,
                cancelTokenPolicy,
                cancelTokenKey: key,
            };
        }
        return url;
    };

    getNewConfig=({ url, timeStamp, cancelTokenPolicy, config, source, key }) => {
        if (toString.call(url) === '[object Object]') {
            return null;
        } if (toString.call(config) === '[object Object]') {
            return {
                ...config,
                cancelToken: source.token,
                actionTimeStamp: timeStamp,
                cancelTokenPolicy,
                cancelTokenKey: key,
            };
        }
        return {
            cancelToken: source.token,
            actionTimeStamp: timeStamp,
            cancelTokenPolicy,
            cancelTokenKey: key,
        };
    };

    requestAbortEvent=(config) => {
        const { actionTimeStamp, cancelTokenPolicy, cancelTokenKey, url } = config;
        switch (cancelTokenPolicy) {
            case policyStatus.first:
                if (this.getFirstTable(cancelTokenKey) !== actionTimeStamp) {
                    const source = this.getCancelTokenTable(actionTimeStamp);
                    source.cancel('在该请求未返回结果前不允许再次发送相同请求');
                    this.deleteTableCache(actionTimeStamp);
                }
                break;
            case policyStatus.latest:
                const firstTimeStamp = this.getFirstTable(cancelTokenKey);
                if (firstTimeStamp !== actionTimeStamp) {
                    const source = this.getCancelTokenTable(firstTimeStamp);
                    source.cancel('用最新请求替换旧请求');
                    this.deleteTableCache(firstTimeStamp);
                }
                break;
            case policyStatus.all:
                break;
            default:
                throw new Error('policy参数无效：必须是first/latest/all之一');
        }
    };

    deleteTableCache=(timeStamp, deleteFirstTimeStamp) => {
        const key = this.getTimeStampTable(timeStamp);
        const firstTimeStamp = this.getFirstTable(key);
        const url = this.getUrlTable(key);
        if (firstTimeStamp === timeStamp && deleteFirstTimeStamp) {
            this.deleteFirstTable(key);
        }
        this.deleteTimeStampTable(timeStamp);
        this.deleteUrlTable(url);
    };

    setRequestInterceptor=(successFn, errorFn) => {
        axios.interceptors.request.use((config) => {
            this.requestAbortEvent(config);
            return successFn(config);
        }, (error) => {
            return errorFn(error);
        });
    };

    setResponseInterceptor = (successFn, errorFn) => {
        // "响应" 拦截器即异常处理
        axios.interceptors.response.use((response) => {
            const { config: {
                actionTimeStamp,
            } } = response;
            this.deleteTableCache(actionTimeStamp, true);
            return successFn(response);
        }, (error) => {
            return errorFn(error);
        });
    };

    ajax = (asyncFn) => {
        // 这里得加cancelToken
        return (url, config) => {
            // 时间戳是唯一的，可以作为这次请求的唯一ID
            const timeStamp = new Date().getTime();
            // 将url和data合为唯一的cancelKey
            const key = this.getKey(url, config);
            const cancelTokenPolicy = this.defaultPolicy;
            // source是用来设置取消请求的source的
            const source = this.initCancelToken({
                timeStamp,
                groupId: null,
                url,
                key,
            });
            return asyncFn(this.getNewUrl({ url, timeStamp, cancelTokenPolicy, source, key }), this.getNewConfig({ url, timeStamp, cancelTokenPolicy, config, source, key }));
        };
    }
}

export default new Ajax();
