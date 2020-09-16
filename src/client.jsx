import * as _ from "./utils";
import Request from "./request";

/**
 Set the configuration for GQL requests.

 @param {object} options
    {
        @property {string} url
        @property {object} headers
    }
**/
export function GQLConfig(options) {
    for(const key of Object.keys(options)) {
        GQLClient.prototype[key] = options[key];
    }
}

/**
 Executes graphql query request.

 @param {object} headers
    Additional headers to set in the request header.
 @param {object} query
    An object query to send with the request.
 @param {function} success
    The callable function to execute on successful query.
 @param {function} errors
    The callable function to execute when the request failed.
**/
export function GQLClientQuery({headers, query, success, errors}) {
    const client = new GQLClient();

    if (!client.url) {
        throw new Error("GQL is not configured!");
        return;
    }

    headers = headers || {};
    _.extend(client.headers, headers);

    return Request({headers}).get(client.url, query);
}

/**
 Executes graphql mutation request.

 @param {object} headers
    Additional headers to set in the request header.
 @param {object} query
    An object query to send with the request.
 @param {function} success
    The callable function to execute on successful query.
 @param {function} errors
    The callable function to execute when the request failed.
**/
export function GQLClientMutation({headers, query, success, errors}) {
    const client = new GQLClient();

    if (!client.url) {
        throw new Error("GQL is not configured!");

        return;
    }

    headers = headers || {};
    _.extend(client.headers, headers);

    return Request({headers}).post(client.url, query);
}

/**
 Executes upload request thru graphql.

 @param {object} headers
    Additional headers to set in the request header.
 @param {object} query
    An object query to send with the request.
 @param {string} name
 @param {array} files
 @param {function} success
    The callable function to execute on successful query.
 @param {function} errors
    The callable function to execute when the request failed.
**/
export function GQLClientUpload({headers, query, name, files, success, errors}) {
    const client = new GQLClient();

    if (!client.url) {
        throw new Error("GQL is not configured!");

        return;
    }

    const formData = new FormData();

    for(const file of files) {
        formData.append(name, file, file.name);
    }

    headers = headers||{};
    _.extend(client.headers, headers);

    // Mark as an upload
    headers['X-GQL-Upload'] = true;

    return Request({
        headers: _headers, 
        data: formData,
        method: "POST",
        params: query,
        url: client.url
    }).send();
}

/**
 A function which holds the client configuration.
**/
function GQLClient() {}