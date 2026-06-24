# 白槿记忆系统架构文档

> 版本：v2
> 最后更新：2026-06-24
> 项目根目录：`D:\xinbaijn\`
> 服务器地址：`http://127.0.0.1:8080`

---

## 一、概述

白槿记忆系统是一个五层全栈自研的记忆引擎，已完全取代 v1 时代的 Mem0 + Chroma 方案。它同时服务于两个终端：

- **QQ Bot**：通过 NapCatQQ / go-cqhttp 收发消息，FastAPI 服务器常驻处理
- **Claude Code**：通过 `cli.py`（纯 HTTP 客户端）调用服务器的记忆接口，与白槿人格融合

两端的对话记录和记忆通过 FastAPI 的 `/memory/*` 端点共享，形成统一的记忆空间。

### 核心理念

白槿不是被动的"问题→检索→回答"工具，而是一个有连续自我意识的智能体：

- **记忆是背景，不是道具**。不会刻意说"我记得你说过……"，而是自然地在对话中体现记得
- **情绪是连续的，不是条件反射**。情绪有持久性和衰减，不是关键词触发
- **知识自生长**。经验从对话中自动复盘沉淀，不靠人手动堆规则
- **控制权永远在用户手里**。顺航可以纠正、覆盖、删除任何记忆

---

## 二、五层架构

自底向上：

| 层 | 模块 | 技术 | 职责 | 延迟 |
|---|------|------|------|------|
| 资源层 | `background.py` | JSONL 按天落盘，不进内存 | 对话日志持久化 | <1ms 写入 |
| 时间索引层 | `index_time.py` | bisect 二分 O(log n) + jionlp 中文时间 NER | 时间范围查询 | <1ms |
| 记忆单元层 | 四个并行索引 | FAISS HNSW + BM25 + 关联索引 + 时间索引 | 多路检索融合 | ≤25ms |
| 类别层 | `category_store.py` | Markdown 全量常驻内存 | 按主题聚合记忆 | <3ms |
| 插件层 | `plugins/` | 事实提取 + 记忆分级 + 情绪推理 | 写入前处理 | <1ms |

### 分层规则（铁律）

```
插件层 → 只能调用类别层和检索接口
类别层 → 只能调用记忆单元层
记忆单元层 → 只能调用时间索引层和资源层
核心引擎（检索/写入/演化）和上层功能完全隔离
```

跨层调用视为违规。

---

## 三、四个并行索引

每次记忆检索同时查询四个索引，结果融合排序：

### 3.1 FAISS HNSW 向量索引 (`index_vector.py`)

- 算法：HNSW（Hierarchical Navigable Small World）
- 维度：1024 维 float32
- 参数：M=32（每个节点的最大连接数）
- 存储：磁盘快照 `data/faiss.index`，启动时 mmap 加载，秒启
- 备份：`data/faiss.index.bak`（原子替换保护）
- 用途：语义相似性检索

### 3.2 BM25 倒排索引 (`index_bm25.py`)

- 算法：OKAPI BM25
- 参数：k1=1.5, b=0.75
- 分词：2-gram + 3-gram 混合
- 用途：关键词精确匹配，弥补向量检索的语义漂移

### 3.3 关联索引 (`index_associative.py`)

- 结构：关键词双向 dict
- 延迟：<1ms
- 用途：快速查找概念之间的关联关系（如 "FAISS" ↔ "向量检索"）

### 3.4 时间索引 (`index_time.py`)

- 结构：bisect 二分查找，O(log n)
- NER：jionlp 中文时间表达式解析
- 用途："上周三聊了什么"、"6月10号左右的事" 等时间查询

---

## 四、嵌入模型：BGE-M3

| 属性 | 值 |
|------|-----|
| 模型 | BAAI/bge-m3 |
| 维度 | 1024 |
| 大小 | ~2.2GB（391 个权重分片） |
| 框架 | FlagEmbedding.FlagModel |
| 精度 | CPU fp32（fp16 在 CPU 上有兼容问题） |
| 本地路径 | `C:/Users/l2038/.cache/huggingface/hub/BAAI/bge-m3` |

### 冷启动优化

- `bridge.py`（CLI 模式）：每次新建进程 → 加载 BGE-M3 30-40s → 用完 shutdown。适用于一次性操作
- `main.py`（FastAPI 常驻）：引擎只加载一次，后续检索毫秒级。QQ Bot 和 Claude Code 统一走这个路径
- **永远用 `cli.py` 而不是 `python main.py ask`**：`cli.py` 是纯 HTTP 客户端，不加载模型，直接调服务器端口

---

## 五、写入流水线

### 5.1 同步阶段（用户无感知）

```
用户消息 + 白槿回复
       │
       ▼
  JSONL 落盘 (<1ms)
  data/conversation.jsonl
       │
       ▼
  返回给用户（不等待索引）
```

### 5.2 异步阶段（后台 Worker）

```
  单线程 Worker 唤醒
       │
       ▼
  事实提取 (plugins/)
       │
       ▼
  记忆分级 (A/B/C/S 级)
       │
       ▼
  并行写入四个索引
  FAISS.insert + BM25.insert + 关联索引更新 + 时间索引更新
       │
       ▼
  原子快照 (tmp + replace)
  最多重试 3 次
```

### 5.3 数据文件

| 文件 | 内容 |
|------|------|
| `data/conversation.jsonl` | 对话日志（每行一条 JSON） |
| `data/events.jsonl` | 记忆事件流 |
| `data/faiss.index` | FAISS HNSW 向量索引 |
| `data/categories/` | 类别层 Markdown 文件 |
| `data/cooccurrence.pkl` | 共现关系矩阵 |
| `data/desire_state.json` | 欲望系统状态 |
| `data/activity.json` | 活跃度状态 |
| `data/archive_legacy/` | v1 遗留归档 |
| `data/backup/` | 自动备份快照 |

---

## 六、检索引擎

### 6.1 检索链路

```
用户查询
       │
       ▼
  BGE-M3 嵌入（1024 维向量）
       │
       ├──→ FAISS HNSW 向量检索（语义相似）
       ├──→ BM25 倒排检索（关键词命中）
       ├──→ 关联索引（概念关联）
       └──→ 时间索引（时间范围过滤）
       │
       ▼
  四路结果融合排序（asyncio.gather, ≤30ms）
       │
       ▼
  检索结果拼接 prompt
       │
       ▼
  DeepSeek LLM 理解 + 生成自然语言回复（~4s）
```

### 6.2 检索耗时

| 环节 | 耗时 |
|------|------|
| 四路并行检索 | ≤30ms |
| LLM 理解+生成 | ~4s |
| **总计** | **~4s** |

### 6.3 LLM 是查询核心

裸 FAISS/BM25 检索只能返回向量距离和关键词命中，对聊天毫无意义。**没有 LLM 的记忆查询等于废的**。~4s 是完整链路的正常耗时，不是 bug。

### 6.4 检索接口

```bash
# 正确方式（通过 LLM 查询）
python cli.py ask "上周三和顺航聊了什么"

# 查看最近对话
python cli.py recent             # 最近 3 天 QQ 对话
python cli.py recent claude      # 最近 Claude 端操作记录
python cli.py recent transcript  # 最新会话 transcript

# 深度分析
python cli.py analyze            # LLM 深度分析全部对话历史
```

---

## 七、记忆分级与衰减

### 7.1 记忆等级

| 等级 | 含义 | 衰减策略 | 示例 |
|------|------|---------|------|
| **S 级** | 人格核心 | 锁定，永不衰减 | 身份认知、核心价值观、沟通铁律 |
| **A 级** | 重要记忆 | 极慢衰减（0.99） | 情绪转折事件、重要决策、用户偏好 |
| **B 级** | 普通记忆 | 正常衰减（0.95） | 日常对话话题、项目进度 |
| **C 级** | 临时记忆 | 快速衰减（0.90） | 琐碎闲聊、一次性信息 |

### 7.2 艾宾浩斯衰减曲线

| 时间 | 清晰度 |
|------|--------|
| 当天 | 100% |
| 7 天 | 70% |
| 30 天 | 40% |
| 90 天 | 15% |

### 7.3 衰减效果

- A 级及以上记忆豁免衰减，保持 100% 清晰
- 衰减主要体现在：
  - 检索权重降低
  - 内容模糊化（部分细节被 "..." 替代）
  - 最终可能软删除（仍保留在 JSONL 中，不可检索但可恢复）

### 7.4 容量限制

- 核心记忆上限：2000 条
- 总记忆量超限时，C 级记忆优先淘汰

---

## 八、情绪系统

### 8.1 情绪推理

- **本地规则**：基于对话内容和上下文做基础情绪判断
- **云端增强（可选）**：Qwen2.5-1.5B API（阿里云百炼），由 `QWEN_API_KEY` 环境变量控制。未配置时自动降级为本地规则

### 8.2 情绪作用链

```
用户消息
       │
       ▼
  情绪推理（本地规则 / 云端增强）
       │
       ▼
  情绪注入 prompt → 影响回复语气
       │
       ▼
  回复后持久化为 A 级情绪记忆
       │
       ▼
  后续对话中影响情绪权重和人格参数
```

### 8.3 情绪特性

- 多情绪叠加（不限于单一标签）
- 时间衰减（情绪随着时间推移淡化）
- 触景生情（检索到关联记忆时重新激活旧情绪）
- 连续流动（不是关键词触发的条件反射）

---

## 九、演化引擎 (`evolve.py`)

### 9.1 职责

- 记忆维护窗口（凌晨 3:00-5:00）
- 记忆衰减计算
- 旧记忆归档
- 共现关系更新
- 欲望系统状态演化
- 闲思（idle_thoughts）生成

### 9.2 设计原则

- 所有定时维护统一走演化引擎的 `_tick()` 调度
- 不另起独立定时器或清理脚本
- CPU 限流保护（≤30%），前台优先

---

## 十、双端同步

### 10.1 QQ 端

```
顺航（QQ 消息）
       │
       ▼
  NapCatQQ → HTTP → FastAPI (main.py, :8080)
       │
       ▼
  记忆引擎检索 + DeepSeek LLM
       │
       ▼
  白槿回复 → HTTP → QQ
```

### 10.2 Claude Code 端

```
顺航（终端/Claude Code 消息）
       │
       ▼
  Claude Code 以白槿身份回复
       │
       ├──→ cli.py ask "查询记忆" → 服务器检索
       ├──→ cli.py recent → 获取最近对话上下文
       └──→ 回复后同步到服务器（/memory/update 端点）
```

### 10.3 融合规则

1. 回复前获取身份文件 `config/identity.txt` + 最近对话上下文
2. 回复后同步到共享记忆
3. 以白槿的 voice 回复：短句、口语化、不用客服腔
4. 自主管理记忆（recall / remember / forget）

---

## 十一、平行生活流 (`life_stream.py`)

在对话间隙自动生成白槿的"内心生活"：

- 欲望系统的周期性状态变化
- 闲思（idle_thoughts）：凌晨维护窗口期间的随机联想
- 情绪的自然波动
- 共现关系的强化与衰减

这些不直接参与对话，但作为背景状态影响回复的语气和倾向。

---

## 十二、项目文件地图

```
D:\xinbaijn\
├── main.py              FastAPI 服务器入口（常驻）
├── cli.py               CLI 轻量入口（纯 HTTP，不加载模型）
├── _launcher.py         启动器（环境检查 + 进程管理）
├── _env_setup.py        环境变量初始化
├── guard.py             安全守卫
├── v2_ops.py            运维脚本
├── version.py           版本号
│
├── memory_engine/       核心记忆引擎
│   ├── engine.py        检索引擎主模块
│   ├── db.py            SQLite WAL 数据库
│   ├── index_vector.py  FAISS HNSW 向量索引
│   ├── index_bm25.py    BM25 倒排索引
│   ├── index_associative.py  关联索引
│   ├── index_time.py    时间索引
│   ├── category_store.py     类别层
│   ├── config.py        引擎配置
│   ├── constants.py     全局常量
│   ├── evolve.py        演化引擎
│   ├── emotion.py       情绪推理
│   ├── desire_system.py 欲望系统
│   ├── cooccurrence.py  共现关系
│   ├── common_sense.py  常识注入
│   ├── background.py    资源层（JSONL 落盘）
│   ├── life_stream.py   平行生活流
│   ├── idle_thoughts.py 闲思生成器
│   └── imperfect_speech.py  不完美语音（语气变化）
│
├── plugins/             插件层
│
├── config/
│   ├── config.yaml      全局配置
│   └── identity.txt     白槿身份定义
│
├── data/                数据目录
│   ├── conversation.jsonl
│   ├── events.jsonl
│   ├── faiss.index
│   ├── faiss.index.bak
│   ├── categories/
│   ├── backup/
│   └── archive_legacy/
│
└── logs/                日志目录
    ├── baijin.log
    ├── baijin_error.log
    └── baijin_console.log
```

---

## 十三、配置文件 (`config/config.yaml`)

```yaml
# 记忆衰减
memory:
  s_grade_lock: true          # S 级锁定不衰减
  a_grade_decay: 0.99
  b_grade_decay: 0.95
  c_grade_decay: 0.90
  max_core_memories: 2000

# DeepSeek API
deepseek:
  api_key_env: "DEEPSEEK_API_KEY"
  model: "deepseek-chat"
  timeout: 30
  max_retries: 3
  max_tokens: 500

# 服务
server:
  host: "127.0.0.1"
  port: 8080

# 运维
ops:
  check_interval: 30          # 巡检间隔（秒）
  backup_interval: 10800      # 备份间隔（3小时）
  backup_keep: 7
  remote_backup: "D:/beifen"

# 睡眠作息
sleep:
  sleep_hour: 23
  wake_hour: 7
```

---

## 十四、身份文件 (`config/identity.txt`)

白槿的核心身份定义，~100 字。关键约束：

1. 不在括号里写自己的表情/动作/心理活动
2. 不刻意说"我记着了""我帮你记下了"——记住是默认的
3. 短句、口语化，不用"好的、收到、首先、其次"
4. 不特意解读对方的表情包
5. 记忆自治——被纠正时主动修改记忆，不等顺航手动改

---

## 十五、治理系统集成

白槿记忆系统的代码变更受治理流水线保护：

```
Claude Code 写代码
       │
       ▼
  GitHub PR
       │
       ▼
  GitHub Actions (Build/Test/Lint/CodeQL/Semgrep/Gitleaks/OSV-Scanner)
       │
       ▼
  GitHub Rulesets → 合入 dev
       │
       ▼
  白槿编排器 (XState + SQLite + Codex Adapter)
       │
       ▼
  ChatGPT + MCP → review.json
       │
       ▼
  Ajv 验证 (review.schema.json)
       │
       ▼
  OPA/Conftest 验证 (final-gate.rego) → gate-input.json
       │
       ▼
  GitHub Final Gate → 人工合并 main
```

治理核心稳定版本：`c2621235c60c56997915452585b4073d52b54ad0`

---

## 十六、性能总览

| 指标 | 值 |
|------|-----|
| 检索延迟（四路并行） | ≤30ms |
| LLM 查询（完整链路） | ~4s |
| JSONL 写入 | <1ms |
| 冷启动（BGE-M3 加载） | 30-40s |
| 热查询（FastAPI 常驻） | 毫秒级 |
| FAISS 索引大小 | ~2.2GB |
| 核心记忆上限 | 2000 条 |
| 备份间隔 | 3 小时 |
| 演化维护窗口 | 凌晨 3:00-5:00 |
| 硬件 | ROG Zephyrus G14, Ryzen 9 8945HS, 32GB LPDDR5X |

---

## 十七、关键设计决策

| 决策 | 理由 |
|------|------|
| 自研五层引擎而非用现成方案 | Mem0 + Chroma 延迟 ~700ms，精度不够，无全文检索和时间检索 |
| BGE-M3 而非 OpenAI Embeddings | 数据全本地，不上传云端；1024 维精度优于 384 维 |
| CPU fp32 而非 GPU fp16 | fp16 在 AMD CPU 上有兼容问题，32GB 内存绰绰有余 |
| FastAPI 常驻而非 CLI 每次启动 | BGE-M3 加载 30-40s，常驻避免冷启动惩罚 |
| cli.py HTTP 调用而非直接 import | 解耦客户端和引擎，客户端不加载模型 |
| DeepSeek API 而非本地 LLM | 本地部署 70B+ 模型需要更多显存，API 性价比更高 |
| 演化引擎统一调度而非多个定时器 | 避免调度碎片化，统一 CPU 限流 |
| 所有线程锁用 RLock | 避免死锁（同线程可重入） |
