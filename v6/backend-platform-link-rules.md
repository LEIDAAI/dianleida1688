# 多平台商品链接识别规则（后端对接文档）

> 用途：图搜批量寻源 —— 导入表格时识别「商品原链接」并透传至导出结果
> 版本：V1.0
> 更新时间：2026-11-09

---

## 一、背景与需求

### 现状

图搜批量寻源导入表格时，只解析并提取**图片链接**用于图搜匹配，导入商品的**原链接**在解析环节丢失。导出结果里只有「图片导入链接」，客户拿不到自己导入的商品链接，无法回溯自己的选品。

### 需求

1. 导入时把表格中的**商品原链接**一并落库（不参与图搜匹配，纯透传）。
2. 导出时新增一列「**商品原链接**」输出该值。

### 为什么需要「按平台识别」

各平台导出的表格里，链接类**列名**不统一：

| 语义 | OZON 选品库 | 亚马逊图搜比价 | 图搜导出结果 |
|---|---|---|---|
| 商品链接 | `商品链接` | `商品链接` | `商品链接` |
| 店铺链接 | `卖家链接` | `店铺链接` | `店铺链接` |
| 图片 | `主图地址` | `商品主图` / `主图链接` | `图片导入链接` / `图搜寻源主图链接` |

**结论**：列名靠不住，**必须以 URL 形态作为主判据**，列名只作为辅助信号。

---

## 二、总体方案：三层识别

```
读取表头
   ↓
第 1 层：列名直接命中（快，覆盖标准导出）
   ↓ 未命中
第 2 层：URL 形态判定（主判据，平台无关）
   ↓ 未命中
第 3 层：用户手动指定列（兜底 UI）
```

**核心原则**：识别阶段只做「判定这一列是什么语义」，**不解析、不改写 URL 本身**。判定为商品链接后，原样存库、原样导出。

---

## 三、判定语义与优先级

一个列只会被判定为以下三种语义之一，**按下列顺序匹配，命中即停**：

| 优先级 | 语义 | 判定依据 |
|---|---|---|
| 1 | **图片** | URL 命中图片特征（CDN 域名 / 图片扩展名 / 图片路径段） |
| 2 | **商品详情页** | URL 命中平台商品详情页特征 |
| 3 | **店铺 / 主页** | URL 命中平台店铺特征 |
| — | 非链接列 | 以上都不命中，忽略 |

> **为什么图片优先于商品**：图片 CDN 域名（如 `alicdn.comozonstatic.cnkwcdn.com`）有时也会带 `/product/` 这类路径段，若先判商品会误判。图片特征更明确，故图片优先。

> **必须命中平台规则才算商品链接**。不要用「看起来像详情页」这种宽松判断，否则店铺首页、搜索页会被误当商品链接透传出去。

---

## 四、平台规则字典

### 4.1 实测数据（已通过真实接口 / 真实导出文件验证）

| 平台 | 商品链接特征 | 店铺链接特征 | 图片特征 |
|---|---|---|---|
| **1688** | `detail.1688.com/offer/{offerId}.html` | `{shop}.1688.com` | `cbu01.alicdn.com/img/ibank/**.alicdn.com` |
| **OZON** | `ozon.ru/product/{sku}` | `ozon.ru/seller/*` | `*.ozonstatic.cn/s3/multimedia*obs.dianleida.net/dld/ozon/image/*` |
| **TEMU** | `temu.com/goods.html?goods_id={id}`、`temu.com/*-p-{id}.html` | `temu.com/mall_id/*` | `img-*.kwcdn.com/product/*` |
| **亚马逊** | `*/dp/{ASIN}*/gp/product/{ASIN}*/gp/aw/d/{ASIN}` | `*/shops/**/stores/**/shop/**/s?me=` | `m.media-amazon.com/images/I/*images-amazon.com/images/I/*` |

**实测样本（可直接用于单测）**：

| 平台 | 样本 URL | 来源 |
|---|---|---|
| 1688 商品 | `https://detail.1688.com/offer/925158972925.html` | 用户导出文件 |
| 1688 店铺 | `https://shop3d4x758012335.1688.com` | 1688 选品库接口实测 |
| 1688 图片 | `https://cbu01.alicdn.com/img/ibank/O1CN01OMCJJK1KANvODyLiG_!!2219632621123-0-cib.jpg` | 1688 选品库接口实测 |
| OZON 商品 | `https://www.ozon.ru/product/146215073` | 用户导出文件 |
| OZON 图片 | `https://ir-20.ozonstatic.cn/s3/multimedia-2/6621307346.jpg` | Ozon 商品接口实测 |
| TEMU 商品 ID | `601100697932959` | TEMU 商品接口实测 |
| TEMU 图片 | `https://img-2.kwcdn.com/product/algo_check/auto/526fd07ede73f7b82af53f527f390ba61780834515754.jpg` | TEMU 商品接口实测 |
| 亚马逊商品 | `https://www.amazon.com/dp/B000IB9QXI` | 官方文档 |

### 4.2 资料来源（未实测，联调时需校验）

| 平台 | 商品链接特征 | 店铺链接特征 | 图片特征 |
|---|---|---|---|
| **速卖通** | `aliexpress.com/item/{itemId}.html`、`aliexpress.com/item/{itemId}_{productId}.html` | `store.aliexpress.com/*`、`*.store.aliexpress.com` | `*.alicdn.com`（与 1688 共用 CDN） |
| **淘宝 / 天猫** | `item.taobao.com/item.htm?id={id}`、`detail.tmall.com/item.htm?id={id}` | `shop{id}.taobao.com`、`shop{id}.tmall.com` | `*.alicdn.com`、`*.tbcdn.cn` |
| **阿里国际** | `alibaba.com/product-detail/*_{id}.html` | `*.alibaba.com` 店铺主页 | `*.alicdn.com`、`*.sc04.alicdn.com` |
| **TikTok Shop** | `shop.tiktok.com/{region}/pdp/{productId}`、`www.tiktok.com/view/product/{productId}`、`shop.tiktok.com/view/item/?product_id=` | `shop.tiktok.com/{region}/seller/*` | `*.tiktokcdn.com`、`*.tiktokcdn-us.com` |
| **SHEIN** | `shein.com/*-p-{goodsId}.html`、`shein.com/pdp-p-{goodsId}.html` | 店铺路径按站点规则 | `img.ltwebstatic.com/*` |
| **Shopee** | `shopee.com/*-i.{shopId}.{itemId}`、`shopee.com.{cc}/*-i.{shopId}.{itemId}` | `shopee.com/{shopName}` | `down-id.img.susercontent.com/*` |

> 表中 `*` 表示任意字符。**联调时请先用真实导出文件核对一次**，把实测结果回填到本表并把状态改为「已实测」。

### 4.3 规则字典结构

后端侧配置化存储，新增平台只加一条记录，不改核心逻辑。仓库已提供可运行的参考实现：

- `backend-platform-link-rules.json` —— 规则字典（机器可读）
- `backend-link-detector.py` —— Python 参考实现 + 34 条用例，**当前 34/34 全通过**

规则结构：

```json
{
  "platform": "amazon",
  "status": "verified",
  "imageCdnHosts": ["*.media-amazon.com", "*.images-amazon.com"],
  "imageHostsWithPath": [
    { "hosts": ["*.amazon.*"], "paths": ["/images/I/"] }
  ],
  "product": {
    "hosts": ["*.amazon.*"],
    "paths": ["^/dp/[A-Z0-9]{9,10}", "^/gp/product/[A-Z0-9]{9,10}", "^/gp/aw/d/[A-Z0-9]{9,10}"],
    "queries": []
  },
  "store": {
    "hosts": ["*.amazon.*"],
    "paths": ["^/shops/", "^/stores/", "^/shop/", "^/s$"],
    "queries": ["^me=", "^seller="]
  }
}
```

**三个必须注意的语义细节（都是实测验出来的坑）**：

1. **`hosts` 用 `*.amazon.*` 通配，不要写死 `.com`** —— 亚马逊有 7 个以上站点域名，且 `smile.amazon.comm.amazon.com` 也可能出现在分享链接里。`*` 必须能匹配到点（`amazon.co.uk` 才能命中）。
2. **`paths` 与 `queries` 是「或」关系**，不是「与」。例如 TEMU 商品链接是 `/goods.html?goods_id=xxx`，特征在 query 里；亚马逊店铺链接 `/s?me=xxx` 同理。空数组表示该维度不参与判定。
3. **图片 CDN 与商品域名不在同一域名下**。1688 商品在 `1688.com`，图片在 `alicdn.com`；OZON 商品在 `ozon.ru`，图片在 `ozonstatic.cn`。所以图片规则必须**独立于平台 host 判断**，否则会大量漏判。

---

## 五、识别算法（后端伪代码）

```
function detect(url):
    host = parseHostname(url)
    path = parsePath(url)
    query = parseQuery(url)

    # 1. 平台专属图片 CDN
    for platform in platforms:
        if hostMatches(host, platform.imageCdnHosts): return IMAGE
        for rule in platform.imageHostsWithPath:
            if hostMatches(host, rule.hosts) and anyMatch(path, rule.paths): return IMAGE

    # 2. 共享图片 CDN（alicdn 等多平台共用）
    if hostMatches(host, sharedImageCdnHosts): return IMAGE

    # 3. 通用图片扩展名兜底
    if path matches /\.(jpg|jpeg|png|webp|gif|bmp|avif|tiff)$/: return IMAGE

    # 4. 商品详情页
    for platform in platforms:
        spec = platform.product
        if hostMatches(host, spec.hosts) and dimsMatch(spec, path, query): return PRODUCT

    # 5. 店铺 / 主页
    for platform in platforms:
        spec = platform.store
        if hostMatches(host, spec.hosts) and dimsMatch(spec, path, query): return STORE

    return NONE

function dimsMatch(spec, path, query):
    # paths 与 queries 是「或」关系；空数组表示该维度不参与
    pathHit = spec.paths 非空 ? anyMatch(path, spec.paths) : null
    queryHit = spec.queries 非空 ? anyMatch(query, spec.queries) : null
    if pathHit == null and queryHit == null: return true   # 仅凭 host 判定
    return pathHit or queryHit
```

**判定顺序不可调换**：图片必须最先判，否则 `alicdn.com/img/ibank/...` 这类路径含 `/img/` 的地址可能被误判。

### 列名辅助信号

列名命中以下任一，可直接采信为对应语义（**仍建议同时用 URL 抽检 1 条**，防止表头写错）：

| 语义 | 列名匹配（忽略大小写、忽略空格与全半角） |
|---|---|
| 商品 | `商品链接商品URL商品地址产品链接产品URLitem urlproduct urlproduct linkgoods urldetail urllisting url` |
| 店铺 | `店铺链接店铺URL卖家链接卖家URLshop urlstore urlseller url` |
| 图片 | `主图主图地址主图链接商品主图图片链接图片地址图片URL主图URLimage urlmain imageprimary imageimagephoto图片` |

> **图片列名不要过度依赖**：OZON 是「主图地址」、亚马逊同时存在「商品主图」和「主图链接」两列、图搜导出是「图片导入链接」。此时**以 URL 形态为准**，列名只用来在多列都像图片时排序优先级。

---

## 六、字段与数据库改造

### 6.1 新增字段

| 层级 | 字段名 | 类型 | 说明 |
|---|---|---|---|
| 图搜任务明细 | `sourceProductUrl` | `varchar(512)` | 导入商品的原始链接，原样存储 |
| 图搜任务明细 | `sourcePlatform` | `varchar(32)` | 识别出的平台标识（amazon / ozon / temu / 1688 …），便于统计与排障 |
| 图搜任务明细 | `sourceProductId` | `varchar(64)` | 从 URL 中抽出的平台商品 ID（ASIN / SKU / offerId / goods_id），可为空 |

`sourceProductUrl` **不参与图搜匹配**，仅透传，对现有图搜逻辑零影响。

### 6.2 导出结果新增列

在现有导出表**末尾追加**一列：

| 列名 | 值 |
|---|---|
| `商品原链接` | `sourceProductUrl` |

**命名注意事项**：

- 现有导出表已有一列 `商品链接`，其值是 **1688 货源链接**（`detail.1688.com/offer/...`）。
- 新列必须叫「**商品原链接**」或「导入商品链接」，**严禁覆盖或复用现有 `商品链接` 列**，否则客户无法区分哪条是 OZON/亚马逊原商品、哪条是寻源到的 1688 货源。
- 建议同时在「图片导入链接」旁加一个「导入商品链接」别名，或在表头加批注说明二者对应关系。

### 6.3 历史数据

存量任务未落库 `sourceProductUrl`，导出时该列为空即可，不影响其他字段。若客户强求历史数据，需重新导入一次原始表格。

---

## 七、异常与边界处理

| 场景 | 处理 |
|---|---|
| 未识别到商品链接列 | 正常导入，不报错；导出时「商品原链接」为空 |
| 识别到多个商品链接列 | 取第一个命中列，其余忽略；记录日志便于排查 |
| 同一列中部分行不是 URL | 跳过该行（不阻断整表导入） |
| URL 带追踪参数（`?ref=?tag=?utm_*`） | **原样保留**，不做清洗（客户要的就是原链接） |
| 短链（`vm.tiktok.com/xxxbit.ly/xxx`） | 原样存储；如需还原长链可另开需求，不在本次范围 |
| 图片链接与商品链接在同一列 | 视为异常列，忽略并告警 |
| 表格有合并表头 / 多行表头 | 需先定位真实表头行；建议取首个全部为字符串且下方紧跟数据行的那行作为表头 |

---

## 八、验收用例

| # | 输入 | 期望 |
|---|---|---|
| 1 | OZON 选品库导出表（31 行，含「商品链接」「卖家链接」「主图地址」） | 图片列 → IMAGE；商品链接列 → PRODUCT；卖家链接列 → STORE |
| 2 | 亚马逊图搜比价导出表（含「商品链接」「店铺链接」「商品主图」「主图链接」） | 商品主图与主图链接 → IMAGE；商品链接 → PRODUCT；店铺链接 → STORE |
| 3 | 仅含「图片链接」一列的表格 | → IMAGE，不产出商品链接，导出「商品原链接」为空 |
| 4 | 含「商品链接」但 URL 为 `amazon.com/dp/B01234XYZ` | → PRODUCT，导出值含完整原始 URL |
| 5 | 含「商品链接」但 URL 为 `amazon.com/shops/xxx` | → STORE，**不得**判为 PRODUCT |
| 6 | 含「商品链接」但值为 `1688.com` 店铺首页 | → STORE，不得判为 PRODUCT |
| 7 | 列名写「商品链接」但值全是图片 URL | → IMAGE（URL 优先于列名） |
| 8 | 含 `?ref=sr_1_5&tag=xx` 的亚马逊链接 | 原样透传，参数不丢 |
| 9 | 导出结果 | 新增列在末尾，名称为「商品原链接」，与原「商品链接」列并存 |
| 10 | 1000 行导入 | 性能无明显退化（列识别只采样前 5 行，非全列扫描） |

> 上表第 1～10 条为业务验收用例。此外，`backend-link-detector.py` 内置 34 条 URL 级别用例（含 3 条反例），当前 **34/34 通过**，后端移植后建议以该脚本作为回归基线。

---

## 九、给后端的实施顺序建议

1. **第一步（最小可用）**：按列名识别「商品链接」列 → 落库 → 导出新增「商品原链接」列。
   覆盖 OZON / 亚马逊 / 1688 / 速卖通等现有全部导出表，因为这几家都叫「商品链接」。
2. **第二步**：接入 URL 形态判定，替换列名硬编码，覆盖列名被用户改写的情况。
3. **第三步**：补全规则字典中「未实测」平台的配置，联调时用真实导出文件逐个校验并回填本表。

---

## 十、附：速查对照

### 已实测（verified）

| 平台 | 商品链接一眼认 | 店铺链接一眼认 | 图片 CDN |
|---|---|---|---|
| 1688 | `detail.1688.com/offer/` | `xxx.1688.com` | `*.alicdn.com`（共享） |
| OZON | `ozon.ru/product/` | `ozon.ru/seller/` | `*.ozonstatic.cnobs.dianleida.net` |
| TEMU | `temu.com/goods.html?goods_id=` 或 `...-p-{id}.html` | `temu.com/mall_id/` | `*.kwcdn.com` |
| 亚马逊 | `/dp/` 或 `/gp/product/` + ASIN | `/shops/` `/stores/` `/shop/` `/s?me=` | `*.media-amazon.com` |

### 待联调校验（reference）

| 平台 | 商品链接一眼认 | 店铺链接一眼认 | 图片 CDN |
|---|---|---|---|
| 速卖通 | `aliexpress.com/item/` | `store.aliexpress.com` | `*.alicdn.com`（共享） |
| 淘宝 / 天猫 | `item.taobao.com/item.htm?id=` / `detail.tmall.com/item.htm?id=` | `shop*.taobao.com` | `*.alicdn.com` / `*.tbcdn.cn`（共享） |
| 阿里国际 | `alibaba.com/product-detail/` | 店铺主页 | `*.alicdn.com`（共享） |
| TikTok Shop | `shop.tiktok.com/*/pdp/` 或 `tiktok.com/view/product/` | `shop.tiktok.com/*/seller/` | `*.tiktokcdn.com` / `*.byteimg.com` |
| SHEIN | `shein.com/*-p-{id}.html` | 店铺路径 | `img.ltwebstatic.com` / `*.sheincdn.com` |
| Shopee | `shopee.com/*-i.{shopId}.{itemId}` | `shopee.{cc}/{shopName}` | `*.susercontent.com` |

---

## 十一、配套文件

| 文件 | 用途 |
|---|---|
| `backend-platform-link-rules.md` | 本文档：需求、规则说明、算法、验收用例 |
| `backend-platform-link-rules.json` | 规则字典（机器可读，后端可直接加载或翻译成 Java 配置） |
| `backend-link-detector.py` | Python 参考实现 + 34 条回归用例（当前 34/34 通过） |

后端如用 Java/Node 实现，直接对照 `backend-link-detector.py` 的 `host_matches` / `dims_match` / `spec_matches` / `detect` 四个函数移植即可，规则全部在 JSON 里，无需改逻辑。
