(function () {
    function getApiBase(path) {
        if (typeof window.getGroupwareApiBase === "function") {
            return window.getGroupwareApiBase(path);
        }
        return String(path || "");
    }

    function isAbsoluteUrl(value) {
        return /^https?:\/\//i.test(String(value || ""));
    }

    function buildUrl(path, query) {
        var url = isAbsoluteUrl(path) ? String(path) : getApiBase(path);
        var queryString = toQueryString(query);
        if (!queryString) return url;
        return url + (url.indexOf("?") === -1 ? "?" : "&") + queryString;
    }

    function toQueryString(query) {
        if (!query) return "";
        if (typeof query === "string") return query.replace(/^\?/, "");

        var params = new URLSearchParams();
        Object.keys(query).forEach(function (key) {
            var value = query[key];
            if (value === undefined || value === null || value === "") return;
            if (Array.isArray(value)) {
                value.forEach(function (item) {
                    if (item !== undefined && item !== null && item !== "") params.append(key, item);
                });
                return;
            }
            params.set(key, value);
        });
        return params.toString();
    }

    function buildHeaders(headers, body) {
        var nextHeaders = Object.assign({}, headers || {});
        var isFormBody = typeof FormData !== "undefined" && body instanceof FormData;
        if (body !== undefined && body !== null && !isFormBody && !nextHeaders["Content-Type"]) {
            nextHeaders["Content-Type"] = "application/json";
        }
        return nextHeaders;
    }

    function buildBody(body) {
        if (body === undefined || body === null) return undefined;
        if (typeof FormData !== "undefined" && body instanceof FormData) return body;
        if (typeof body === "string") return body;
        return JSON.stringify(body);
    }

    async function request(path, options) {
        options = options || {};
        var response = await fetch(buildUrl(path, options.query), {
            method: options.method || "GET",
            headers: buildHeaders(options.headers, options.body),
            body: buildBody(options.body),
            credentials: options.credentials || "same-origin",
            keepalive: options.keepalive === true
        });

        var data = null;
        if (options.parseJson !== false) {
            data = await response.json().catch(function () { return {}; });
        }

        var shouldRequireSuccess = options.successRequired !== false;
        var isFailedSuccess = data && data.success === false;
        if (!response.ok || (shouldRequireSuccess && isFailedSuccess)) {
            throw createApiError(response, data, options.errorMessage);
        }

        return data;
    }

    function createApiError(response, data, fallbackMessage) {
        var message = data && data.message || fallbackMessage || "요청을 처리하지 못했습니다.";
        var error = new Error(message);
        error.status = response && response.status;
        error.response = response;
        error.data = data;
        return error;
    }

    function get(path, query, options) {
        return request(path, Object.assign({}, options || {}, { method: "GET", query: query }));
    }

    function post(path, body, options) {
        return request(path, Object.assign({}, options || {}, { method: "POST", body: body }));
    }

    function attachmentUrl(path, query) {
        return buildUrl(path, query);
    }

    window.GroupwareApi = {
        buildUrl: buildUrl,
        get: get,
        post: post,
        request: request,
        attachmentUrl: attachmentUrl,
        toQueryString: toQueryString
    };
})();
