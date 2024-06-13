// noinspection DuplicatedCode

const IPv4_REGEX = /^(?:[0-1]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])\.(?:[0-1]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])\.(?:[0-1]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])\.(?:[0-1]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])$/;

const guess_type = (url = null) => {
    if (!url || typeof url !== 'string') {
        return null;
    }
    if (url.match(/socks5|[=\/]socks5([\/&]|$)/i)) {
        return 'socks5';
    } else if (url.match(/socks4|[=\/]socks4([\/&]|$)/i)) {
        return 'socks4';
    } else if (url.match(/http[_.\-&]|[=\/]http([\/&]|$)/i)) {
        return 'http';
    } else if (url.match(/https[_.\-&]|[=\/]http([\/&]|$)/i)) {
        return 'https';
    }
    return null;
}

const parser = {
    html: (text, url = null) => {
        if (typeof text !== 'string') {
            return [];
        }
        text = text.trim();
        if (text === '') {
            return [];
        }
        if (!text.includes('<') && !text.includes('>') && !/<body[^>]*>/.test(text)) {
            return [];
        }
        let document = new DOMParser().parseFromString(text, 'text/html');
        document = document.body;
        // find the table
        let tables = document.querySelectorAll('table');
        let result = [];
        let the_type = guess_type(url);
        if (tables.length > 0) {
            for (let table of tables) {
                // find the tr-tag
                table = table.querySelectorAll('tr');
                if (table.length === 0) {
                    continue;
                }
                // find nested table on td if contains ipv4 and port from text of td
                table.forEach((tr) => {
                    let td = tr.querySelectorAll('td');
                    if (td.length === 0) {
                        return;
                    }
                    let proxy = null;
                    let type = null;
                    for (let _td of td) {
                        if (proxy && type) {
                            break;
                        }
                        _td = _td.textContent.trim();
                        if (!proxy && _td.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5}$/)) {
                            proxy = _td;
                            continue;
                        }
                        if (!type && _td.match(/^(socks4|socks5|http|https)$/i)) {
                            type = _td.toLowerCase();
                            continue;
                        }
                        if (proxy && !type && _td.match(/^(socks4|socks5|http|https)$/i)) {
                            type = _td.toLowerCase();
                            break;
                        }
                    }
                    // next check without protocol
                    if (!proxy) {
                        let ip = null;
                        let port = null;
                        for (let _td of td) {
                            if (proxy && type) {
                                break;
                            }
                            _td = _td.textContent.trim();
                            if (!ip && _td.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
                                ip = _td;
                                continue;
                            }
                            if (ip && !port && _td.match(/^\d+$/) && parseInt(_td) > 0 && parseInt(_td) < 65535) {
                                port = _td;
                                proxy = `${ip}:${port}`;
                                continue;
                            }
                            if (!type && _td.match(/^(socks4|socks5|http|https)$/i)) {
                                type = _td.toLowerCase();
                                continue;
                            }
                            if (proxy && !type && _td.match(/^(socks4|socks5|http|https)$/i)) {
                                type = _td.toLowerCase();
                                break;
                            }
                        }
                    }
                    if (!proxy) {
                        return;
                    }
                    let lines = proxy.split(':');
                    if (lines.length !== 2) {
                        return;
                    }
                    let ip = lines[0];
                    let port = parseInt(lines[1]);
                    if (port < 1 || port > 65535) {
                        return;
                    }
                    if (IPv4_REGEX.test(ip) !== true) {
                        return;
                    }
                    type = type || the_type;
                    let value = type ? `${type}://${ip}:${port}` : `http://${ip}:${port}`;
                    if (!result.includes(value)) {
                        result.push(value);
                    }
                });
            }
        }
        return result;
    },
    /**
     * Parse text to get proxy list
     * @param {object|string} text
     * @param {string|null} url
     * @returns {string[]}
     */
    json: (text, url = null) => {
        if (typeof text !== 'string' && typeof text !== 'object') {
            return [];
        }
        let object;
        if (typeof text === 'string') {
            text = text.trim();
            if (text === '') {
                return [];
            }
            try {
                object = JSON.parse(text);
            } catch (error) {
                return [];
            }
        } else {
            object = text;
            text = null;
        }
        if (!object || typeof object !== 'object') {
            return [];
        }

        /**
         * Guess the object
         * Should be ip: "ipv4", port: "number"|number, protocol: "string"|protocols: ["string"]
         * @param object
         * @returns {*|boolean}
         */
        const guess_loop = (object) => {
            for (let i in object) {
                let item = object[i];
                if (typeof item !== 'object') {
                    continue;
                }
                if (!item.ip || typeof item.ip !== 'string' || IPv4_REGEX.test(item.ip) !== true) {
                    continue;
                }
                if (!item.port || (typeof item.port !== 'string' && typeof item.port !== 'number')) {
                    continue;
                }
                return object;
            }
            return false;
        }
        let found = guess_loop(object);

        if (!found) {
            // guessing
            for (let key in object) {
                if (typeof object[key] !== 'object') {
                    continue;
                }
                found = guess_loop(object[key]);
                if (found) {
                    object = object[key];
                    break;
                }
                for (let i in object[key]) {
                    if (!object[key][i] || typeof object[key][i] !== 'object') {
                        continue;
                    }
                    found = guess_loop(object[key][i]);
                    if (found) {
                        object = object[key][i];
                        break;
                    }
                }
                if (found) {
                    break;
                }
            }
        }
        if (!found) {
            return [];
        }

        object = found;
        found = null;
        let type = guess_type(url);
        const allowedTypes = ['socks4', 'socks5', 'http', 'https'];
        let result = [];
        for (let key in object) {
            let item = object[key];
            if (!item || typeof item !== 'object') {
                continue;
            }
            // only support ipv4
            if (IPv4_REGEX.test(item.ip) !== true) {
                continue;
            }
            let port = item.port.toString();
            if (!/^\d+$/.test(port)) {
                continue;
            }
            item.port = parseInt(port);
            if (port < 1 || port > 65535) {
                continue;
            }
            let protocols = [];
            if (item.hasOwnProperty('protocol')) {
                if (typeof item.protocol === 'string') {
                    item.protocol = item.protocol.toLowerCase();
                    if (allowedTypes.includes(item.protocol)) {
                        protocols.push(item.protocol);
                    }
                }
            } else if (item.hasOwnProperty('type')) {
                if (typeof item.type === 'string') {
                    item.type = item.type.toLowerCase();
                    if (allowedTypes.includes(item.type)) {
                        protocols.push(item.protocol);
                    }
                }
            }
            if (protocols.length < 1) {
                if (item.hasOwnProperty('protocols') && Array.isArray(item.protocols)) {
                    for (let protocol of item.protocols) {
                        if (typeof protocol === 'string') {
                            protocol = protocol.toLowerCase();
                            if (allowedTypes.includes(protocol) && !protocols.includes(protocol)) {
                                protocols.push(protocol);
                            }
                        }
                    }
                }
            }
            let value;
            if (!protocols.length) {
                value = type ? `${type}://${item.ip}:${item.port}` : `http://${item.ip}:${item.port}`;
                if (!result.includes(value)) {
                    result.push(value);
                }
                continue;
            }
            for (let protocol of protocols) {
                if (typeof protocol !== 'string') {
                    continue;
                }
                protocol = protocol.toLowerCase();
                if (!allowedTypes.includes(protocol)) {
                    continue;
                }
                let value = `${protocol}://${item.ip}:${item.port}`;
                if (!result.includes(value)) {
                    result.push(value);
                }
            }
        }
        return result;
    },
    /**
     * Parse text to get proxy list
     * @param text
     * @param url
     * @returns {*[]}
     */
    text: (text, url = null) => {
        if (typeof text !== 'string') {
            return [];
        }
        text = text.trim();
        if (text === '') {
            return [];
        }
        let type = guess_type(url);
        text = text.split('\n');
        let result = [];
        const number = '0123456789';
        for (let line of text) {
            if (line.trim() === '') {
                continue;
            }
            if (!line.includes(':') || line.match(/^\s/)) {
                continue;
            }
            let currentType = type;
            let match = line.match(/^(socks4|socks5|http|https):\/\//i);
            if (match) {
                currentType = match[1].toLowerCase();
                line = line.replace(/^(socks4|socks5|http|https):\/\//i, '');
            }
            if (!number.includes(line[0])) {
                continue;
            }
            let lines = line.replace(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,5})(\D.*)?$/g, '$1').split(':');
            if (lines.length !== 2) {
                continue;
            }
            let ip = lines[0];
            let port = parseInt(lines[1]);
            if (port < 1 || port > 65535) {
                continue;
            }
            if (IPv4_REGEX.test(ip) !== true) {
                continue;
            }
            let value = currentType ? `${currentType}://${ip}:${port}` : `http://${ip}:${port}`;
            if (!result.includes(value)) {
                result.push(value);
            }
        }
        return result;
    }
};

export default parser;
