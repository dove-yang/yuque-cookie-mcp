# 语雀 MCP 服务器 (Enhanced)

通过 MCP 协议让 AI 助手管理你的语雀文档。**支持 Cookie 自动化登录，无需超级会员**。

> **Enhanced fork** based on [xiaocong/yuque-cookie-mcp](https://github.com/xiaocong/yuque-cookie-mcp) v1.0.2 (original repo unavailable as of 2026-07)

## 此 Fork 新增功能

| 工具 | 分类 | 说明 |
|------|------|------|
| `create_repo` | 知识库管理 | 创建新知识库（Cookie 模拟网页操作） |
| `delete_repo` | 知识库管理 | 删除知识库 |
| `list_notes` | 小记管理 | 列出所有小记（分页支持） |
| `get_note` | 小记管理 | 获取单篇小记完整内容 |
| `create_note` | 小记管理 | 创建小记（lake 格式） |
| `update_note` | 小记管理 | 更新小记内容 |

> 小记功能通过语雀网页内部 API (`/api/modules/note/notes/NoteController`) 实现，官方 OpenAPI 不覆盖小记，仅 Cookie 模式下可用。

## 功能

### Cookie 文档格式兼容性

Cookie 模式的 `create_doc` / `update_doc` 及公司空间对应工具，默认仍接收 Markdown，
但先通过语雀 `/api/docs/convert` 转为 Lake，再以 `format: lake`、`origin_format: lake`
保存，避免出现网页发布错误 `invalid format: markdown, can not save use body field`。
转换失败会中止写入，不回退到原来的 Markdown 保存方式。此补丁不自动发布文档。
内部写入同时维护 `body` 和编辑器使用的 `body_asl`，避免仅更新旧字段导致发布内容为空。

- 写入工具新增 `format: markdown | lake`（这是输入格式，不是 Cookie 文档的存储格式）。
- 读取工具新增 `include_lake: true`，返回可用于保留原始排版的 `body_lake`。
- Cookie 读取支持 `include_draft: true`，用于检查未发布的编辑正文；默认仍读已发布正文。
- `body` 是供阅读的 Markdown/近似 Markdown；`body_is_lossy` 明确提示可能丢失富文本细节。
  不要把阅读用的 `body` 当作无损备份：复杂卡片、图片、表格应在 Lake 原文上编辑。
- 更新工具支持 `expected_updated_at`，在写入前尽力检测并发修改；不是服务器原子锁。
- 标题更新不会强制改动正文或格式；空正文不再被静默忽略。
- 登录和读取 Cookie 统一使用 `os.homedir()` 定位用户目录，兼容没有 `HOME` 环境变量的 Windows。
- Token 分支继续走原有 OpenAPI；上述格式转换针对 Cookie 模式。
  官方新版 Markdown/YMD 路由不在本次修改范围内。
- 代码已修改后，需要重连 MCP 或重启宿主应用，旧进程不会自动加载新代码。

运行通用回归测试：`npm test`。测试使用模拟接口，不读取 Cookie 或修改线上文档。

### 通用工具

| 工具 | 说明 |
|------|------|
| `check_auth_status` | 检查认证状态和 Cookie 有效期 |
| `refresh_cookie` | 刷新 Cookie（自动打开浏览器登录） |
| `get_user_info` | 获取当前用户信息 |
| `get_doc_by_url` | **通过语雀链接直接获取文档**（支持个人/公司空间） |

### 知识库管理

| 工具 | 说明 |
|------|------|
| `list_repos` | 列出所有知识库 |
| `get_repo` | 获取知识库详情 |
| `create_repo` | 创建新知识库 |
| `delete_repo` | 删除知识库 |
| `get_repo_toc` | 获取知识库目录结构 |

### 文档操作

| 工具 | 说明 |
|------|------|
| `list_docs` | 列出知识库文档 |
| `get_doc` | 获取文档内容 |
| `create_doc` | 创建文档 |
| `update_doc` | 更新文档 |
| `delete_doc` | 删除文档 |
| `search_docs` | 搜索文档 |

### 小记管理（新增）

| 工具 | 说明 |
|------|------|
| `list_notes` | 列出所有小记（支持分页） |
| `get_note` | 获取单篇小记完整内容 |
| `create_note` | 创建小记（lake 格式） |
| `update_note` | 更新小记 |

### 公司空间

| 工具 | 说明 |
|------|------|
| `list_org_repos` | 列出公司空间的知识库 |
| `list_org_docs` | 列出公司空间知识库的文档 |
| `get_org_doc` | 获取公司空间文档内容 |
| `create_org_doc` | 在公司空间创建文档 |
| `update_org_doc` | 更新公司空间文档 |

## 安装

```bash
npm install -g github:dove-yang/yuque-cookie-mcp
```

## 首次登录

运行以下命令，会自动打开浏览器让你登录语雀：

```bash
cd ~/myCode/mcp/yuque-mcp
npm run login
```

登录成功后，Cookie 会自动保存到 `~/.yuque-mcp/cookies.json`，有效期约 2 周。

## 配置 Cursor

编辑 `~/.cursor/mcp.json`，添加：

```json
{
  "mcpServers": {
    "yuque": {
      "command": "node",
      "args": ["/Users/xiaocong/myCode/mcp/yuque-mcp/dist/index.js"]
    }
  }
}
```

**注意**：使用 Cookie 方式不需要配置环境变量。

## 认证方式

### 方式一：Cookie 自动登录（推荐，免费）

1. 运行 `npm run login`
2. 在打开的浏览器中登录语雀
3. 登录成功后自动保存 Cookie

Cookie 过期后，在对话中说"刷新语雀 Cookie"即可重新登录。

### 方式二：Token（需要超级会员）

如果你有语雀超级会员，可以使用 Token：

```json
{
  "mcpServers": {
    "yuque": {
      "command": "node",
      "args": ["/Users/xiaocong/myCode/mcp/yuque-mcp/dist/index.js"],
      "env": {
        "YUQUE_TOKEN": "你的语雀Token"
      }
    }
  }
}
```

## 使用示例

配置完成后，在 Cursor 中可以这样对话：

- "检查语雀认证状态"
- "帮我看看我有哪些知识库"
- **"帮我建一个叫 agent 的知识库"** ← 新增
- "列出 xxx 知识库的目录结构"
- "帮我在 xxx 知识库创建一篇文档，记录今天的会议纪要"
- "更新 xxx 文档，把刚才讨论的内容加进去"
- "搜索关于 xxx 的文档"
- **"查看 https://www.yuque.com/xxx/xxx/xxx 这个文档"** ← 直接通过链接获取
- "查看公司空间的知识库"
- "查看后端专区这个知识库的文档目录"
- **"帮我看看昨天写了哪些小记"** ← 新增
- **"创建一篇小记记录今天的想法"** ← 新增

## Cookie 说明

- Cookie 保存位置：`~/.yuque-mcp/cookies.json`
- 默认有效期：14 天
- 如果经常使用语雀网页版，Cookie 会自动续期
- 过期后说"刷新语雀 Cookie"即可重新登录

## 开发

```bash
# 克隆仓库
git clone https://github.com/dove-yang/yuque-cookie-mcp.git
cd yuque-cookie-mcp

# 手动登录获取 Cookie
node login.js

# 启动服务器
node index.js
```

## License

MIT — forked from [xiaocong/yuque-cookie-mcp](https://github.com/xiaocong/yuque-cookie-mcp)
