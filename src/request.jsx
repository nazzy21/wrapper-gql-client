import axios from "axios";
import * as _ from "./utils";

const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, */*;q=0.1'
};

export default function Request(options = {}) {
    options.headers = _.extend({}, DEFAULT_HEADERS, options.headers || {});

    const req = axios.create(options);

    const send = (method, url, params, config, onCancel) => {
        config.CancelToken = onCancel && axios.CancelToken(onCancel);

        if (!params) {
            return req[method](url, config);
        }

        return req[method](url, params, config);
    };

    return {
        send: () => axios(options),
        head: (url, params, onCancel = false) =>
            send('head', url, false, {params}, onCancel),

        get: (url, params, onCancel = false) =>
            send( 'get', url, false, {params}, onCancel),

        post: (url, data, onCancel = false) =>
            send( 'post', url, data, {}, onCancel ),

        postUpload: (url, data, params) => {
            const postOptions = _.clone(options);
            postOptions.data = data;
            postOptions.url = url;
            postOptions.method = "POST";
            postOptions.params = params;

            return axios(postOptions);
        },

        put: (url, data, onCancel = false) =>
            send( 'put', url, data, {}, onCancel),

        delete: (url, params, onCancel = false) =>
            send( 'delete', url, false, {params}, onCancel ),

        patch: (url, data, onCancel = false) =>
            send( 'patch', url, data, {}, onCancel ),

        upload(url, data, onCancel = false) {
            let _headers = _.extend(options.headers, {
                headers: {'Content-Type' : 'multipart/form-data; boundary=' + (new Date()).getTime()}
            });

            return send( 'post', data, {headers: _headers}, onCancel);
        }
    };
}