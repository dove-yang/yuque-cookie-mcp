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
exports.YuqueClient = void 0;
const axios_1 = __importStar(require("axios"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const YUQUE_BASE_URL = 'https://www.yuque.com';
const ORG_BASE_URL = 'https://bd-tech.yuque.com';
const CONFIG_DIR = path.join(os.homedir(), '.yuque-mcp');
const COOKIE_FILE = path.join(CONFIG_DIR, 'cookies.json');
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
class YuqueClient {
    client;
    authType;
    userLogin = '';
    ctoken = '';
    constructor(tokenOrCookie) {
        const token = tokenOrCookie || process.env.YUQUE_TOKEN;
        const { cookie, ctoken } = this.loadCookie();
        if (token) {
            this.authType = 'token';
            this.client = axios_1.default.create({
                baseURL: `${YUQUE_BASE_URL}/api/v2`,
                headers: {
                    'X-Auth-Token': token,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Yuque-MCP/1.0'
                }
            });
        }
        else if (cookie) {
            this.authType = 'cookie';
            this.ctoken = ctoken;
            this.client = axios_1.default.create({
                baseURL: YUQUE_BASE_URL,
                headers: {
                    'Cookie': cookie,
                    'Content-Type': 'application/json',
                    'User-Agent': BROWSER_USER_AGENT,
                    'Referer': 'https://www.yuque.com/',
                    'x-csrf-token': ctoken
                }
            });
        }
        else {
            throw new Error('未配置语雀认证信息。\n\n' +
                '请运行登录命令: cd ~/myCode/mcp/yuque-mcp && npm run login');
        }
    }
    loadCookie() {
        try {
            if (!fs.existsSync(COOKIE_FILE)) {
                return { cookie: null, ctoken: '' };
            }
            const data = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
            if (new Date(data.expiresAt) < new Date()) {
                console.error('Cookie 已过期，请重新登录');
                return { cookie: null, ctoken: '' };
            }
            const cookie = data.cookies.map(c => `${c.name}=${c.value}`).join('; ');
            const ctokenCookie = data.cookies.find(c => c.name === 'yuque_ctoken');
            const ctoken = ctokenCookie?.value || '';
            return { cookie, ctoken };
        }
        catch {
            return { cookie: null, ctoken: '' };
        }
    }
    getAuthType() {
        return this.authType;
    }
    getCookieStatus() {
        try {
            if (!fs.existsSync(COOKIE_FILE)) {
                return { valid: false, message: '未找到 Cookie 文件，请运行: npm run login' };
            }
            const data = JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'));
            const expiresAt = new Date(data.expiresAt);
            const now = new Date();
            if (expiresAt < now) {
                return { valid: false, expiresAt: data.expiresAt, message: 'Cookie 已过期，请重新登录' };
            }
            const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            return {
                valid: true,
                expiresAt: data.expiresAt,
                message: `Cookie 有效，剩余 ${daysLeft} 天`
            };
        }
        catch {
            return { valid: false, message: '读取 Cookie 文件失败' };
        }
    }
    handleError(error) {
        if (error instanceof axios_1.AxiosError) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            if (status === 401) {
                throw new Error('Cookie 已失效，请重新登录：\n' +
                    'cd ~/myCode/mcp/yuque-mcp && npm run login');
            }
            else if (status === 404) {
                throw new Error(`资源不存在: ${message}`);
            }
            else if (status === 403) {
                throw new Error(`权限不足: ${message}`);
            }
            throw new Error(`语雀 API 错误 (${status}): ${message}`);
        }
        throw error;
    }
    async getUserInfo() {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get('/user');
                return response.data.data;
            }
            else {
                const response = await this.client.get('/api/mine');
                const data = response.data.data;
                this.userLogin = data.login;
                return {
                    id: data.id,
                    login: data.login,
                    name: data.name,
                    avatar_url: data.avatar_url,
                    description: data.description || '',
                    books_count: data.books_count
                };
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async listRepos() {
        try {
            if (this.authType === 'token') {
                const user = await this.getUserInfo();
                const response = await this.client.get(`/users/${user.login}/repos`);
                return response.data.data;
            }
            else {
                const response = await this.client.get('/api/mine/book_stacks');
                const stacks = response.data.data;
                const books = [];
                for (const stack of stacks) {
                    for (const book of stack.books || []) {
                        books.push({
                            id: book.id,
                            slug: book.slug,
                            name: book.name,
                            description: book.description || '',
                            items_count: book.items_count,
                            public: book.public,
                            user: {
                                id: book.user.id,
                                login: book.user.login,
                                name: book.user.name
                            },
                            created_at: book.created_at,
                            updated_at: book.updated_at
                        });
                    }
                }
                return books;
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getRepo(bookId) {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get(`/repos/${bookId}`);
                return response.data.data;
            }
            else {
                const response = await this.client.get(`/api/books/${bookId}`);
                const book = response.data.data;
                return {
                    id: book.id,
                    slug: book.slug,
                    name: book.name,
                    description: book.description || '',
                    items_count: book.items_count,
                    public: book.public,
                    user: {
                        id: book.user.id,
                        login: book.user.login,
                        name: book.user.name
                    },
                    created_at: book.created_at,
                    updated_at: book.updated_at
                };
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getRepoToc(bookId) {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get(`/repos/${bookId}/toc`);
                return response.data.data;
            }
            else {
                const response = await this.client.get(`/api/books/${bookId}/toc`);
                const tocData = response.data.data;
                // 内部 API 返回格式是 { toc: [...] }
                return tocData.toc || tocData || [];
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async listDocs(bookId) {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get(`/repos/${bookId}/docs`);
                return response.data.data;
            }
            else {
                const response = await this.client.get(`/api/books/${bookId}/docs`);
                const docs = response.data.data || [];
                return docs.map((doc) => ({
                    id: doc.id,
                    slug: doc.slug,
                    title: doc.title,
                    description: doc.description || '',
                    format: doc.format,
                    public: doc.public,
                    status: doc.status,
                    word_count: doc.word_count,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at
                }));
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    validateBodyFormat(format) {
        if (!['markdown', 'lake'].includes(format)) {
            throw new Error('正文输入格式仅支持 markdown 或 lake；format 表示输入格式，不会把 Cookie 文档改成 Markdown 类型。');
        }
    }
    async prepareCookieBody(body, format = 'markdown', httpClient = this.client) {
        this.validateBodyFormat(format);
        if (typeof body !== 'string') throw new Error('body 必须是字符串');
        let lake = body;
        if (format === 'markdown') {
            // 官方网页转换接口只转换内容，不创建或修改任何文档。
            const response = await httpClient.post('/api/docs/convert', {
                from: 'markdown', to: 'lake', content: body
            }, { timeout: 30000 });
            lake = response.data?.data?.content;
        }
        if (typeof lake !== 'string' || !/^\s*<!doctype lake>/i.test(lake)) {
            throw new Error('Lake 正文无效或 Markdown 转换失败，已停止写入；不会回退到不兼容的 Markdown 保存方式。');
        }
        return { body: lake, body_asl: lake, format: 'lake', origin_format: 'lake', _lake_is_asl: true };
    }
    getOrgCookieClient() {
        const { cookie, ctoken } = this.loadCookie();
        if (!cookie) throw new Error('请先登录');
        return axios_1.default.create({
            baseURL: ORG_BASE_URL,
            headers: {
                'Cookie': cookie, 'Content-Type': 'application/json',
                'User-Agent': BROWSER_USER_AGENT, 'Referer': `${ORG_BASE_URL}/`,
                'x-csrf-token': ctoken
            }
        });
    }
    readableCookieDoc(doc, includeLake = false) {
        const bodyIsLake = typeof doc.body === 'string' && /^\s*<!doctype lake>/i.test(doc.body);
        const lake = doc.content || doc.body_lake || doc.body_draft_asl || doc.body_asl || (bodyIsLake ? doc.body : '');
        const hasBody = typeof doc.body === 'string' && !bodyIsLake;
        return {
            id: doc.id, slug: doc.slug, title: doc.title,
            description: doc.description || '', format: doc.format,
            origin_format: doc.origin_format ?? doc.originFormat,
            public: doc.public, status: doc.status, word_count: doc.word_count,
            created_at: doc.created_at, updated_at: doc.updated_at,
            body: hasBody ? doc.body : this.extractTextFromLake(lake),
            body_format: hasBody ? 'markdown' : 'markdown_approx',
            body_is_lossy: Boolean(lake),
            body_html: doc.body_html ?? doc.content_html,
            ...(includeLake ? { body_lake: lake } : {})
        };
    }
    checkExpectedUpdate(doc, expectedUpdatedAt) {
        if (expectedUpdatedAt !== undefined && doc.updated_at !== expectedUpdatedAt) {
            throw new Error('文档已发生变化，已停止覆盖；请重新读取文档后再编辑。');
        }
    }
    async getDoc(bookId, slug, includeLake = false, includeDraft = false) {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get(`/repos/${bookId}/docs/${slug}?raw=1`);
                return response.data.data;
            }
            else {
                // 内部 API 需要先获取用户 login
                if (!this.userLogin) {
                    await this.getUserInfo();
                }
                const response = await this.client.get(`/api/docs/${slug}`, {
                    params: { book_id: bookId, ...(includeDraft ? { mode: 'edit' } : {}) }
                });
                const doc = response.data.data;
                return this.readableCookieDoc(doc, includeLake);
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async createDoc(bookId, title, body, format = 'markdown', slug) {
        try {
            this.validateBodyFormat(format);
            if (this.authType === 'token') {
                const data = { title, body, format };
                if (slug)
                    data.slug = slug;
                const response = await this.client.post(`/repos/${bookId}/docs`, data);
                return response.data.data;
            }
            else {
                const data = {
                    title,
                    ...await this.prepareCookieBody(body, format),
                    type: 'Doc',
                    book_id: bookId,
                    insert_to_catalog: true
                };
                if (slug)
                    data.slug = slug;
                const response = await this.client.post('/api/docs', data);
                const doc = response.data.data;
                return {
                    id: doc.id,
                    slug: doc.slug,
                    title: doc.title,
                    description: doc.description || '',
                    format: doc.format,
                    public: doc.public,
                    status: doc.status,
                    word_count: doc.word_count || 0,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at
                };
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async updateDoc(bookId, docId, options) {
        try {
            const data = {};
            if (options.title !== undefined)
                data.title = options.title;
            if (this.authType === 'token') {
                if (options.body !== undefined) {
                    this.validateBodyFormat(options.format ?? 'markdown');
                    data.body = options.body;
                    data.format = options.format ?? 'markdown';
                }
                if (options.expected_updated_at !== undefined) {
                    const current = (await this.client.get(`/repos/${bookId}/docs/${docId}?raw=1`)).data.data;
                    this.checkExpectedUpdate(current, options.expected_updated_at);
                }
                const response = await this.client.put(`/repos/${bookId}/docs/${docId}`, data);
                return response.data.data;
            }
            else {
                if (options.body !== undefined) {
                    Object.assign(data, await this.prepareCookieBody(options.body, options.format ?? 'markdown'));
                }
                if (options.body !== undefined || options.expected_updated_at !== undefined) {
                    const current = (await this.client.get(`/api/docs/${docId}`, { params: { book_id: bookId } })).data.data;
                    if (current.book_id !== bookId) throw new Error('文档不属于指定知识库，已停止写入');
                    this.checkExpectedUpdate(current, options.expected_updated_at);
                }
                const response = await this.client.put(`/api/docs/${docId}`, data);
                const doc = response.data.data;
                return {
                    id: doc.id,
                    slug: doc.slug,
                    title: doc.title,
                    description: doc.description || '',
                    format: doc.format,
                    origin_format: doc.origin_format,
                    public: doc.public,
                    status: doc.status,
                    word_count: doc.word_count || 0,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at
                };
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async deleteDoc(bookId, docId) {
        try {
            if (this.authType === 'token') {
                await this.client.delete(`/repos/${bookId}/docs/${docId}`);
            }
            else {
                await this.client.delete(`/api/docs/${docId}`);
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // ========== 知识库管理 ==========
    async createRepo(name, description, isPublic, repoType) {
        try {
            if (this.authType === 'token') {
                const data = { name, description: description || '', public: isPublic ? 1 : 0, type: repoType || 'Book' };
                const response = await this.client.post('/user/repos', data);
                return response.data.data;
            }
            else {
                const data = { name, description: description || '', public: isPublic ? 1 : 0, type: repoType || 'Book' };
                const response = await this.client.post('/api/books', data);
                const book = response.data.data;
                return {
                    id: book.id,
                    slug: book.slug,
                    name: book.name,
                    description: book.description || '',
                    items_count: book.items_count,
                    public: book.public,
                    user: book.user ? {
                        id: book.user.id,
                        login: book.user.login,
                        name: book.user.name
                    } : null,
                    created_at: book.created_at,
                    updated_at: book.updated_at
                };
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async deleteRepo(bookId) {
        try {
            if (this.authType === 'token') {
                await this.client.delete(`/repos/${bookId}`);
            }
            else {
                await this.client.delete(`/api/books/${bookId}`);
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // ========== 小记管理 ==========
    async listNotes(limit, offset) {
        try {
            const params = {};
            if (limit) params.limit = limit;
            if (offset) params.offset = offset;
            const response = await this.client.get('/api/modules/note/notes/NoteController/index', { params });
            const data = response.data;
            const notes = (data.notes || []).map(note => ({
                id: note.id,
                slug: note.slug,
                abstract: note.content?.abstract || '',
                word_count: note.word_count,
                has_image: note.has_image,
                has_attachment: note.has_attachment,
                has_bookmark: note.has_bookmark,
                tags: note.tags || [],
                published_at: note.published_at,
                created_at: note.created_at,
                updated_at: note.updated_at,
                save_from: note.save_from || ''
            }));
            return {
                notes,
                pin_notes: (data.pin_notes || []).map(n => n.id),
                has_more: data.has_more || false
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getNote(noteId) {
        try {
            const response = await this.client.get('/api/modules/note/notes/NoteController/show', {
                params: { id: noteId }
            });
            const note = response.data;
            return {
                id: note.id,
                slug: note.slug,
                abstract: note.content?.abstract || '',
                source: note.content?.source || '',
                html: note.content?.html || '',
                format: note.content?.format || 'lake',
                word_count: note.word_count,
                has_image: note.has_image,
                has_attachment: note.has_attachment,
                has_bookmark: note.has_bookmark,
                tags: note.tags || [],
                published_at: note.published_at,
                created_at: note.created_at,
                updated_at: note.updated_at,
                save_from: note.save_from || ''
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async createNote(html, source, abstract) {
        try {
            const data = { html, source, abstract };
            const response = await this.client.post('/api/modules/note/notes/NoteController/create', data);
            const note = response.data;
            return {
                id: note.id,
                slug: note.slug,
                abstract: note.content?.abstract || '',
                word_count: note.word_count,
                has_image: note.has_image,
                tags: note.tags || [],
                published_at: note.published_at,
                created_at: note.created_at,
                updated_at: note.updated_at
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async updateNote(noteId, html, source, abstract) {
        try {
            const data = { html, source, abstract };
            const response = await this.client.put('/api/modules/note/notes/NoteController/update', data, {
                params: { id: noteId }
            });
            const result = response.data;
            const note = result.data || result;
            return {
                id: note.id,
                slug: note.slug,
                abstract: note.content?.abstract || '',
                word_count: note.word_count,
                has_image: note.has_image,
                tags: note.tags || [],
                published_at: note.published_at,
                created_at: note.created_at,
                updated_at: note.updated_at
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async searchDocs(query) {
        try {
            if (this.authType === 'token') {
                const response = await this.client.get('/search', { params: { q: query, type: 'doc' } });
                return response.data.data;
            }
            else {
                const response = await this.client.get('/api/zsearch', {
                    params: { q: query, type: 'content', scope: 'own', p: 1 }
                });
                const hits = response.data.data?.hits || [];
                return hits.map((hit) => {
                    const record = hit.record || {};
                    const book = record.book || {};
                    const highlight = hit.highlight || {};
                    return {
                        id: record.id,
                        title: record.title,
                        slug: record.slug,
                        book_id: book.id,
                        book_name: book.name,
                        summary: highlight.abstract?.[0] || record.description || ''
                    };
                });
            }
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // ========== 公司空间 API ==========
    async listOrgRepos() {
        try {
            const { cookie } = this.loadCookie();
            if (!cookie) {
                throw new Error('请先登录');
            }
            const response = await axios_1.default.get(`${ORG_BASE_URL}/api/books?limit=100&offset=0`, {
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': `${ORG_BASE_URL}/`
                }
            });
            const books = response.data.data || [];
            return books.map((book) => {
                const user = book.user || {};
                return {
                    id: book.id,
                    slug: book.slug,
                    name: book.name,
                    description: book.description || '',
                    items_count: book.items_count,
                    public: book.public,
                    user: {
                        id: user.id,
                        login: user.login,
                        name: user.name
                    },
                    created_at: book.created_at,
                    updated_at: book.updated_at
                };
            });
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async getOrgDoc(bookId, slug, includeLake = false, includeDraft = false) {
        try {
            const httpClient = this.getOrgCookieClient();
            const response = await httpClient.get(`/api/docs/${slug}`, { params: { book_id: bookId, ...(includeDraft ? { mode: 'edit' } : {}) } });
            const doc = response.data.data;
            return this.readableCookieDoc(doc, includeLake);
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async listOrgDocs(bookId) {
        try {
            const { cookie } = this.loadCookie();
            if (!cookie) {
                throw new Error('请先登录');
            }
            const response = await axios_1.default.get(`${ORG_BASE_URL}/api/books/${bookId}/docs`, {
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': `${ORG_BASE_URL}/`
                }
            });
            const docs = response.data.data || [];
            return docs.map((doc) => ({
                id: doc.id,
                slug: doc.slug,
                title: doc.title,
                description: doc.description || '',
                format: doc.format,
                public: doc.public,
                status: doc.status,
                word_count: doc.word_count,
                created_at: doc.created_at,
                updated_at: doc.updated_at
            }));
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async createOrgDoc(bookId, title, body, format = 'markdown') {
        try {
            const httpClient = this.getOrgCookieClient();
            const prepared = await this.prepareCookieBody(body, format, httpClient);
            const response = await httpClient.post(`/api/books/${bookId}/docs`, { title, ...prepared, type: 'Doc' });
            const doc = response.data.data;
            return {
                id: doc.id,
                slug: doc.slug,
                title: doc.title,
                description: doc.description || '',
                format: doc.format,
                public: doc.public,
                status: doc.status,
                word_count: doc.word_count || 0,
                created_at: doc.created_at,
                updated_at: doc.updated_at
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async updateOrgDoc(docId, options) {
        try {
            const httpClient = this.getOrgCookieClient();
            const data = {};
            if (options.title !== undefined)
                data.title = options.title;
            if (options.body !== undefined) {
                Object.assign(data, await this.prepareCookieBody(options.body, options.format ?? 'markdown', httpClient));
            }
            if (options.expected_updated_at !== undefined) {
                const current = (await httpClient.get(`/api/docs/${docId}`)).data.data;
                this.checkExpectedUpdate(current, options.expected_updated_at);
            }
            const response = await httpClient.put(`/api/docs/${docId}`, data);
            const doc = response.data.data;
            return {
                id: doc.id,
                slug: doc.slug,
                title: doc.title,
                description: doc.description || '',
                format: doc.format,
                public: doc.public,
                status: doc.status,
                word_count: doc.word_count || 0,
                created_at: doc.created_at,
                updated_at: doc.updated_at
            };
        }
        catch (error) {
            this.handleError(error);
        }
    }
    // ========== URL 解析获取文档 ==========
    extractTextFromLake(lakeContent) {
        if (!lakeContent)
            return '';
        const codeBlocks = [];
        // 移除 lake 格式的 meta 标签
        let text = lakeContent.replace(/<!doctype lake>/, '');
        text = text.replace(/<meta[^>]*>/g, '');
        // 保留代码卡片。旧实现会把它当成未知 card 删除。
        text = text.replace(/<card[^>]*name="codeblock"[^>]*value="data:([^"]*)"[^>]*>.*?<\/card>/gs, (match, encodedData) => {
            try {
                const data = JSON.parse(decodeURIComponent(encodedData));
                const code = String(data.code || '');
                const fences = code.match(/`+/g) || [];
                const fence = '`'.repeat(Math.max(3, ...fences.map(s => s.length + 1)));
                const language = String(data.mode || '').replace(/[\r\n`]/g, '');
                codeBlocks.push(`\n${fence}${language}\n${code}\n${fence}\n`);
                return `\u0000yuque-code-${codeBlocks.length - 1}\u0000`;
            }
            catch { return '\n[无法解析的代码卡片；请读取 body_lake]\n'; }
        });
        // 提取图片 card 标签并转换为 Markdown 图片格式
        text = text.replace(/<card[^>]*name="image"[^>]*value="data:([^"]*)"[^>]*>/g, (match, encodedData) => {
            try {
                const jsonData = JSON.parse(decodeURIComponent(encodedData));
                const src = jsonData.src || '';
                const name = jsonData.name || '图片';
                return `\n![${name}](${src})\n`;
            }
            catch {
                return '';
            }
        });
        // 提取附件 card 标签
        text = text.replace(/<card[^>]*name="localdoc"[^>]*value="data:([^"]*)"[^>]*>/g, (match, encodedData) => {
            try {
                const jsonData = JSON.parse(decodeURIComponent(encodedData));
                const src = jsonData.src || '';
                const name = jsonData.name || '附件';
                return `\n📎 [${name}](${src})\n`;
            }
            catch {
                return '';
            }
        });
        // 将常见标签转换为 Markdown 格式
        text = text.replace(/<h1[^>]*>(.*?)<\/h1>/g, '# $1\n');
        text = text.replace(/<h2[^>]*>(.*?)<\/h2>/g, '## $1\n');
        text = text.replace(/<h3[^>]*>(.*?)<\/h3>/g, '### $1\n');
        text = text.replace(/<h4[^>]*>(.*?)<\/h4>/g, '#### $1\n');
        text = text.replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n');
        text = text.replace(/<br\s*\/?>/g, '\n');
        text = text.replace(/<li[^>]*>(.*?)<\/li>/g, '- $1\n');
        text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)');
        text = text.replace(/<strong[^>]*>(.*?)<\/strong>/g, '**$1**');
        text = text.replace(/<em[^>]*>(.*?)<\/em>/g, '*$1*');
        text = text.replace(/<code[^>]*>(.*?)<\/code>/g, '`$1`');
        // 处理表格 - 简单提取文本
        text = text.replace(/<tr[^>]*>/g, '\n');
        text = text.replace(/<td[^>]*>(.*?)<\/td>/g, '| $1 ');
        text = text.replace(/<th[^>]*>(.*?)<\/th>/g, '| $1 ');
        // 移除剩余的 HTML 标签（包括未处理的 card 标签）
        text = text.replace(/<card[^>]*>.*?<\/card>/g, '');
        text = text.replace(/<[^>]+>/g, '');
        // 清理多余的空白
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.replace(/&amp;/g, '&');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/\u0000yuque-code-(\d+)\u0000/g, (_, index) => codeBlocks[Number(index)]);
        return text.trim();
    }
    parseYuqueUrl(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            // 路径格式: /{group_or_user}/{book_slug}/{doc_slug}
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            if (pathParts.length < 3) {
                return null;
            }
            const isOrg = hostname !== 'www.yuque.com' && hostname.endsWith('.yuque.com');
            const namespace = `${pathParts[0]}/${pathParts[1]}`;
            const docSlug = pathParts[2];
            return {
                domain: `https://${hostname}`,
                isOrg,
                namespace,
                docSlug
            };
        }
        catch {
            return null;
        }
    }
    async getDocByUrl(url, includeLake = false, includeDraft = false) {
        const parsed = this.parseYuqueUrl(url);
        if (!parsed) {
            throw new Error(`无效的语雀链接: ${url}\n支持的格式: https://www.yuque.com/{user}/{book}/{doc} 或 https://{org}.yuque.com/{group}/{book}/{doc}`);
        }
        const { domain, namespace, docSlug } = parsed;
        const { cookie, ctoken } = this.loadCookie();
        if (!cookie) {
            throw new Error('请先登录: cd ~/myCode/mcp/yuque-mcp && npm run login');
        }
        try {
            // 访问页面获取 appData（包含 book_id 和 doc_id）
            const pageResponse = await axios_1.default.get(`${domain}/${namespace}/${docSlug}`, {
                headers: {
                    'Cookie': cookie,
                    'User-Agent': BROWSER_USER_AGENT,
                    'Accept': 'text/html'
                }
            });
            // 从页面中解析 appData
            const html = pageResponse.data;
            const match = html.match(/decodeURIComponent\("([^"]+)"\)/);
            if (!match) {
                throw new Error('无法解析页面数据');
            }
            const decoded = decodeURIComponent(match[1]);
            const appData = JSON.parse(decoded);
            const bookInfo = appData.book || {};
            const docInfo = appData.doc || {};
            // 使用 API 获取文档完整内容
            const docResponse = await axios_1.default.get(`${domain}/api/docs/${docInfo.slug}`, {
                params: { book_id: bookInfo.id, ...(includeDraft ? { mode: 'edit' } : {}) },
                headers: {
                    'Cookie': cookie,
                    'User-Agent': BROWSER_USER_AGENT,
                    'x-csrf-token': ctoken
                }
            });
            const doc = docResponse.data.data;
            return {
                doc: this.readableCookieDoc(doc, includeLake),
                book: {
                    id: bookInfo.id,
                    name: bookInfo.name,
                    slug: bookInfo.slug
                },
                url
            };
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                if (error.response?.status === 401) {
                    throw new Error('Cookie 已失效，请重新登录: cd ~/myCode/mcp/yuque-mcp && npm run login');
                }
                else if (error.response?.status === 404) {
                    throw new Error(`文档不存在或无权访问: ${url}`);
                }
            }
            this.handleError(error);
        }
    }
}
exports.YuqueClient = YuqueClient;
//# sourceMappingURL=yuque-client.js.map
