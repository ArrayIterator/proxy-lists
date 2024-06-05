import path from "node:path";
import fs from "node:fs";
import parser from "./parser.js";
import readline from 'readline';
const USER_AGENTS = [
    "Mozilla/5.0 (Linux; Android 14.0; Mobile) Presto/521.43 Version/514.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/551.32 Safari/537.36",
    "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:106.0) Gecko/20100101 Firefox/106.0",
    "Mozilla/5.0 (Linux; Android 12.0; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/526.0 Mobile Safari/537.36 Edg/526.0",
    "Mozilla/5.0 (Android 12.0; Mobile; rv:107.0) Gecko/20100101 Firefox/107.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/552.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14.0; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/802.0 Mobile Safari/537.36 UCBrowser/802.0",
    "Mozilla/5.0 (Linux; Android 8.0; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/686.0 Mobile Safari/537.36 UCBrowser/686.0",
    "Mozilla/5.0 (X11; Arch; Linux x86_64; rv:105.0) Gecko/20100101 Firefox/105.0",
    "Mozilla/5.0 (Linux; Android 13.0; Mobile) Presto/559.95 Version/507.0",
    "Mozilla/5.0 (Linux; Android 12.0; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/776.0 Mobile Safari/537.36 YaBrowser/776.0",
    "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/519.72 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 10.0; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/556.0 Mobile Safari/537.36 YaBrowser/556.0",
    "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/782.0 Safari/537.36 YaBrowser/782.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_0) Chrome/524.71 Version/526.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/745.0 Mobile Safari/537.36 AlohaBrowser/745.0",
    "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/564.2 Safari/537.36 Brave/564.2",
    "Mozilla/5.0 (Linux; Android 15.0; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/517.0 Mobile Safari/537.36 Edg/517.0",
    "Mozilla/5.0 (Linux; Android 10.0; Mobile) Presto/555.64 Version/537.0",
    "Mozilla/5.0 (X11; Arch; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/867.0 Safari/537.36 Tor/867.0",
    "Mozilla/5.0 (X11; Arch; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/522.0 Safari/537.36 Tor/522.0",
    "Mozilla/5.0 (Linux; Android 13.0; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/582.0 Mobile Safari/537.36 UCBrowser/582.0",
    "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Version/592.8.42 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/561.69 Safari/537.36",
    "Mozilla/5.0 (X11; Arch; Linux x86_64) Chrome/547.96 Version/527.0",
    "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/539.5 Safari/537.36 Vivaldi/539.5",
    "Mozilla/5.0 (Windows NT 6.3; Win64; x64) Chrome/532.46 Version/525.0"
];
const ROOT = import.meta.dirname;
const MAX_CONCURRENT_REQUESTS = 15; // 15 concurrent requests
const URI_TXT_FILE = path.resolve(ROOT, 'data/uri.txt');
const PROXY_DIRECTORY = path.resolve(ROOT, 'proxies')
const README_FILE = path.resolve(ROOT, 'README.md');
const README_TEMPLATE = `
## PROXY LIST UPDATE EVERY 12 HOURS

Proxy list updated every 12 hours. You can use the following links to get the latest proxy list.

[![.github/workflows/periodic.yaml](https://github.com/ArrayIterator/proxy-lists/actions/workflows/periodic.yaml/badge.svg?branch=main)](https://github.com/ArrayIterator/proxy-lists/actions/workflows/periodic.yaml)

## LAST UPDATE

Last update \`{update}\` with total \`{total}\` proxies.

ALL (protocol://ip:port)

\`\`\`
https://raw.githubusercontent.com/ArrayIterator/proxy-lists/main/proxies/all.txt
\`\`\`

SOCKS5

\`\`\`
https://raw.githubusercontent.com/ArrayIterator/proxy-lists/main/proxies/socks5.txt
\`\`\`

SOCKS4

\`\`\`
https://raw.githubusercontent.com/ArrayIterator/proxy-lists/main/proxies/socks4.txt
\`\`\`

HTTP

\`\`\`
https://raw.githubusercontent.com/ArrayIterator/proxy-lists/main/proxies/http.txt
\`\`\`

HTTPS

\`\`\`
https://raw.githubusercontent.com/ArrayIterator/proxy-lists/main/proxies/https.txt
\`\`\`

## LICENSE

[THE UNLICENSED](LICENSE)
`
let uri = fs.readFileSync(URI_TXT_FILE, 'utf-8').split('\n').filter((uri) => uri.length > 0 || /^https?:\/\//.test(uri));

const proxies = {
    socks4: [],
    socks5: [],
    http: [],
    https: []
};

let concurrent = 0;
let timeout;

const put_proxies = () => {
    process.stdout.write(`Writing proxies to file\r`);
    let all = [];
    if (!fs.existsSync(PROXY_DIRECTORY)) {
        fs.mkdirSync(PROXY_DIRECTORY);
    }
    for (let type in proxies) {
        const file = PROXY_DIRECTORY + '/' + type + '.txt';
        process.stdout.write(`Writing [${proxies[type].length}] proxies to ${path.basename(file)}`);
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        fs.writeFileSync(file,'');
        for (let proxy of proxies[type]) {
            fs.writeFileSync(file, proxy + "\n", { flag: 'a' });
            if (type !== 'unknown') {
                proxy = `${type}://${proxy}`;
            }
            if (all.includes(proxy)) {
                continue;
            }
            all.push(proxy);
        }
        delete proxies[type];
    }
    process.stdout.write(`Writing [${all.length}] proxies to all.txt\r`);
    fs.writeFileSync(PROXY_DIRECTORY + '/all.txt','');
    let count = 0;
    for (let proxy of all) {
        count++;
        fs.writeFileSync(PROXY_DIRECTORY + '/all.txt', proxy + "\n", { flag: 'a' });
    }
    fs.writeFileSync(README_FILE, README_TEMPLATE.replace('{update}', new Date().toISOString()).replace('{total}', count.toString()));
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(`Success getting ${count} proxies`);
    all = null;
    process.exit(0);
}
const get_proxy = () => {
    if (uri.length === 0) {
        put_proxies();
        return;
    }
    if (concurrent > 0) {
        setTimeout(get_proxy, 1000);
        return;
    }
    while (uri.length && concurrent < MAX_CONCURRENT_REQUESTS) {
        let url = uri.shift();
        if (!url) {
            setTimeout(get_proxy, 1000);
            break;
        }
        concurrent++;
        let abort = new AbortController();
        let signal_timeout = setTimeout(() => {
            abort.abort();
        }, 10000); // set timeout to 10 seconds
        fetch(
            url,
            {
                signal: abort.signal,
                headers: {
                    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                    'Referer': 'https://www.github.com',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'max-age=0'
                }
            })
            .then(async (response) => {
                concurrent--;
                if (concurrent < 0) {
                    concurrent = 0;
                }
                clearTimeout(signal_timeout);
                if (timeout) {
                    clearTimeout(timeout);
                }
                let text = await response.text();
                let proxy;
                // check if contain json
                text = text.trim();
                if (text.startsWith('{') || text.startsWith('[')) {
                    proxy = parser.json(text, url);
                } else if (text.includes('<') && text.includes('>')) {
                    // check if contain html
                    proxy = parser.html(text, url);
                } else {
                    // check if contain text
                    proxy = parser.text(text, url);
                }
                if (proxy.length > 0) {
                    proxy.forEach((value) => {
                        if (typeof value !== 'string') {
                            return;
                        }
                        let types = value.match(/^(socks4|socks5|http|https):\/\//i);
                        let type;
                        if (!types) {
                            return;
                        } else {
                            type = types[1].toLowerCase();
                            value = value.replace(/^(socks4|socks5|http|https):\/\//i, '').trim();
                        }
                        if (!value.includes(':')) {
                            return;
                        }
                        if (!proxies[type]) {
                            console.log(type);
                            process.exit();
                        }
                        if (proxies[type].includes(value)) {
                            return;
                        }
                        proxies[type].push(value);
                    });
                }
                timeout = setTimeout(get_proxy, 1000);
            })
            .catch(() => {
                clearTimeout(signal_timeout);
                concurrent--;
                if (concurrent < 0) {
                    concurrent = 0;
                }
                if (timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(get_proxy, 1000);
            });
    }
}

process.stdout.write(`Getting proxies from ${uri.length} sources\r`);
get_proxy();
