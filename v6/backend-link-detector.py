"""多平台链接语义识别参考实现（后端可参照移植）。

用法：
    python backend-link-detector.py            # 跑内置用例
    python backend-link-detector.py <url> ...  # 检测指定 URL

规则文件：backend-platform-link-rules.json
语义：IMAGE=图片链接，PRODUCT=商品详情页链接，STORE=店铺/主页链接，NONE=非链接
"""
import json
import os
import re
import sys
from urllib.parse import urlparse

RULES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend-platform-link-rules.json")

with open(RULES_PATH, encoding="utf-8") as fh:
    RULES = json.load(fh)


def host_matches(host, patterns):
    """host 模式匹配。* 匹配任意字符（含点），用于 *.amazon.* 这类多级域名。"""
    if not patterns:
        return False
    for pattern in patterns:
        regex = "^" + "".join(
            ".*" if part == "*" else re.escape(part)
            for part in re.split(r"(\*)", pattern)
        ) + "$"
        if re.match(regex, host, re.I):
            return True
    return False


def dims_match(text, patterns):
    """patterns 为空表示该维度不参与判定，返回 None 表示「不参与」。"""
    if not patterns:
        return None
    for pattern in patterns:
        if re.search(pattern, text, re.I):
            return True
    return False


def spec_matches(spec, path, query):
    """paths 与 queries 是「或」关系；两者都为空时仅凭 host 命中即可。"""
    path_hit = dims_match(path, spec.get("paths"))
    query_hit = dims_match(query, spec.get("queries"))
    if path_hit is None and query_hit is None:
        return True
    return bool(path_hit) or bool(query_hit)


def detect(url):
    """返回 (语义, 平台)。平台为 None 表示共享 CDN 等无法归属的情况。"""
    parsed = urlparse(url.strip())
    if not parsed.scheme or not parsed.hostname:
        return "NONE", None
    host = parsed.hostname
    path = parsed.path or ""
    query = parsed.query or ""

    # 1. 图片：平台专属 CDN
    for platform in RULES["platforms"]:
        if host_matches(host, platform["imageCdnHosts"]):
            return "IMAGE", platform["platform"]
        for rule in platform["imageHostsWithPath"]:
            if host_matches(host, rule["hosts"]) and dims_match(path, rule["paths"]):
                return "IMAGE", platform["platform"]

    # 2. 图片：共享 CDN（alicdn 等，多平台共用，无法归属具体平台）
    if host_matches(host, RULES["sharedImageCdnHosts"]):
        return "IMAGE", None

    # 3. 图片：通用扩展名兜底
    if re.search(r"\.(jpg|jpeg|png|webp|gif|bmp|avif|tiff)$", path, re.I):
        return "IMAGE", None

    # 4. 商品详情页
    for platform in RULES["platforms"]:
        spec = platform["product"]
        if host_matches(host, spec["hosts"]) and spec_matches(spec, path, query):
            return "PRODUCT", platform["platform"]

    # 5. 店铺 / 主页
    for platform in RULES["platforms"]:
        spec = platform["store"]
        if host_matches(host, spec["hosts"]) and spec_matches(spec, path, query):
            return "STORE", platform["platform"]

    return "NONE", None


CASES = [
    ("https://detail.1688.com/offer/925158972925.html", "PRODUCT", "1688"),
    ("https://shop3d4x758012335.1688.com", "STORE", "1688"),
    ("https://cbu01.alicdn.com/img/ibank/O1CN01OMCJJK1KANvODyLiG_!!2219632621123-0-cib.jpg", "IMAGE", None),
    ("https://www.ozon.ru/product/146215073", "PRODUCT", "ozon"),
    ("https://www.ozon.ru/seller/123456", "STORE", "ozon"),
    ("https://ir-20.ozonstatic.cn/s3/multimedia-2/6621307346.jpg", "IMAGE", "ozon"),
    ("https://obs.dianleida.net/dld/ozon/image/20260711/b3d9ac1a38", "IMAGE", "ozon"),
    ("https://www.amazon.com/dp/B000IB9QXI", "PRODUCT", "amazon"),
    ("https://www.amazon.co.uk/gp/product/B01234XYZ?ref=sr_1_5&tag=xx-21", "PRODUCT", "amazon"),
    ("https://www.amazon.com/gp/aw/d/B08N5WRWNW/ref=x", "PRODUCT", "amazon"),
    ("https://www.amazon.com/shops/SomeStore", "STORE", "amazon"),
    ("https://www.amazon.com/stores/BrandName", "STORE", "amazon"),
    ("https://www.amazon.com/shop/influencerhandle", "STORE", "amazon"),
    ("https://m.media-amazon.com/images/I/41abcdefgh.jpg", "IMAGE", "amazon"),
    ("https://www.temu.com/goods.html?goods_id=601100697932959", "PRODUCT", "temu"),
    ("https://www.temu.com/x-abc-p-601100697932959.html", "PRODUCT", "temu"),
    ("https://www.temu.com/mall_id/634418216933667.html", "STORE", "temu"),
    ("https://img-2.kwcdn.com/product/algo_check/auto/526fd07ede.jpg", "IMAGE", "temu"),
    ("https://www.aliexpress.com/item/1005006123456789.html", "PRODUCT", "aliexpress"),
    ("https://store.aliexpress.com/123456.html", "STORE", "aliexpress"),
    ("https://item.taobao.com/item.htm?id=654321987", "PRODUCT", "taobao"),
    ("https://shop123456.taobao.com", "STORE", "taobao"),
    ("https://img.alicdn.com/imgextra/i1/xxx.jpg", "IMAGE", None),
    ("https://www.alibaba.com/product-detail/Portable-Juicer-1234567890.html", "PRODUCT", "alibaba"),
    ("https://www.tiktok.com/view/product/1734567890", "PRODUCT", "tiktok"),
    ("https://shop.tiktok.com/us/pdp/1734567890", "PRODUCT", "tiktok"),
    ("https://shop.tiktok.com/us/seller/123456", "STORE", "tiktok"),
    ("https://us.shein.com/Womens-Dress-p-20995261-cat-1234.html", "PRODUCT", "shein"),
    ("https://shopee.com.my/Bluetooth-Headphones-i.123456.789012", "PRODUCT", "shopee"),
    ("https://down-id.img.susercontent.com/file/abc123.jpg", "IMAGE", "shopee"),
    # 反例：不得误判为商品链接
    ("https://www.amazon.com/s?me=ABCDEFGHIJ", "STORE", "amazon"),
    ("https://www.google.com/search?q=oizonz", "NONE", None),
    ("https://www.dianleida.net/1688/competeShop/", "NONE", None),
    ("https://detail.1688.com/offer/925158972925.html", "PRODUCT", "1688"),
]


def run_cases():
    passed = 0
    failures = []
    print("期望        实得        平台           结果   URL")
    print("-" * 120)
    for url, expected, expected_platform in CASES:
        got, platform = detect(url)
        ok = got == expected and platform == expected_platform
        passed += 1 if ok else 0
        if not ok:
            failures.append((url, expected, expected_platform, got, platform))
        print(f"{expected:<12}{got:<12}{str(platform):<15}{'OK ' if ok else 'FAIL'}  {url[:50]}")
    print(f"\n通过 {passed}/{len(CASES)}")
    if failures:
        print("\n失败明细：")
        for url, expected, expected_platform, got, platform in failures:
            print(f"  {url}\n    期望 {expected}/{expected_platform}，实得 {got}/{platform}")
    return passed, failures


def main():
    if len(sys.argv) > 1:
        for url in sys.argv[1:]:
            semantics, platform = detect(url)
            print(f"{semantics:<10}{platform or '-':<12}{url}")
        return 0
    passed, failures = run_cases()
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
