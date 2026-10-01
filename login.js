#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const CONFIG_DIR = path.join(os.homedir(), '.yuque-mcp');
const COOKIE_FILE = path.join(CONFIG_DIR, 'cookies.json');
// 组织域名列表（登录后会自动访问这些域名以获取 Cookie）
const ORG_DOMAINS = [
    'https://bd-tech.yuque.com'
];
async function login() {
    console.log('🚀 启动浏览器，请在打开的窗口中登录语雀...\n');
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const browser = await playwright_1.chromium.launch({
        headless: false,
        channel: 'chrome',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox',
            '--disable-infobars',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=BlockInsecurePrivateNetworkRequests',
        ],
    });
    const context = await browser.newContext();
    // Hide automation markers from detection
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
        // @ts-ignore
        delete window.__playwright__binding__;
        // @ts-ignore
        window.chrome = { runtime: {} };
    });
    const page = await context.newPage();
    await page.goto('https://www.yuque.com/login', { waitUntil: 'domcontentloaded' });
    console.log('📝 请在浏览器中完成登录...');
    console.log('   登录成功后会自动保存 Cookie（包括公司空间）\n');
    try {
        await page.waitForURL(url => {
            const urlPath = new URL(url).pathname;
            return urlPath === '/' || urlPath.startsWith('/dashboard') || urlPath.startsWith('/explore');
        }, { timeout: 300000 });
        await page.waitForLoadState('networkidle');
        console.log('✅ 个人空间登录成功\n');
        // 访问组织域名以获取组织 Cookie
        for (const orgDomain of ORG_DOMAINS) {
            console.log(`🔄 正在获取组织 Cookie: ${orgDomain}`);
            try {
                await page.goto(orgDomain, { waitUntil: 'networkidle', timeout: 30000 });
                await page.waitForTimeout(2000);
                console.log(`   ✓ ${orgDomain} Cookie 已获取\n`);
            }
            catch (e) {
                console.log(`   ⚠ ${orgDomain} 访问失败，跳过\n`);
            }
        }
        const cookies = await context.cookies();
        const yuqueCookies = cookies.filter(c => c.domain.includes('yuque.com'));
        if (yuqueCookies.length === 0) {
            console.error('❌ 未获取到 Cookie，请确保已登录');
            await browser.close();
            process.exit(1);
        }
        const cookieData = {
            cookies: yuqueCookies,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        };
        fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookieData, null, 2));
        // 统计各域名的 Cookie 数量
        const domainStats = {};
        yuqueCookies.forEach(c => {
            domainStats[c.domain] = (domainStats[c.domain] || 0) + 1;
        });
        console.log('✅ 登录成功！Cookie 已保存到:', COOKIE_FILE);
        console.log(`   有效期至: ${cookieData.expiresAt}`);
        console.log(`   Cookie 数量: ${yuqueCookies.length}`);
        console.log('   域名分布:');
        Object.entries(domainStats).forEach(([domain, count]) => {
            console.log(`     - ${domain}: ${count} 个`);
        });
    }
    catch (error) {
        console.error('❌ 登录超时或失败');
        console.error('   请重新运行登录命令: npm run login');
    }
    await browser.close();
    console.log('\n👋 浏览器已关闭');
}
login().catch(console.error);
//# sourceMappingURL=login.js.map
