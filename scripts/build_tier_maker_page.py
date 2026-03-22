# One-off builder: merge demo-tier-maker-v1-image into tier-maker.html with site nav + header.
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
demo = (ROOT / "public/demo-tier-maker-v1-image.html").read_text(encoding="utf-8")
lines = demo.splitlines()

m = re.search(r"<style>([\s\S]*?)</style>", demo)
style_block = m.group(1) if m else ""
# demo 的 .page 改由 .container + .tier-maker-v1-page 承接
style_block = re.sub(
    r"^\s*\.page\s*\{[^}]*\}\s*\n",
    "",
    style_block,
    count=1,
    flags=re.MULTILINE,
)
style_block += """
        /* tier-maker.html：主內容區（取代 demo 的 .page） */
        .tier-maker-v1-page {
            max-width: 960px;
            margin: 0 auto;
            padding: 0 0 1.5rem;
        }
"""

scripts = list(re.finditer(r"<script([^>]*)>([\s\S]*?)</script>", demo))
main_script = ""
for s in reversed(scripts):
    tag = s.group(1)
    body = s.group(2)
    if "src=" in tag:
        continue
    if len(body) > 1000:
        main_script = body
        break

popovers = "\n".join(lines[724:769])
main_html = "\n".join(lines[512:722])

NAV = """    <nav class="navbar">
        <div class="navbar-container">
            <a href="index.html" class="navbar-logo">
                <div class="navbar-logo-text" style="display:flex;flex-direction:column;line-height:1.3;">
                    <span style="display:block;font-size:1.1rem;font-weight:700;">MBTI ×</span>
                    <span style="display:block;font-size:1.1rem;font-weight:700;">桌遊配對</span>
                </div>
            </a>
            <ul class="navbar-menu">
                <li><a href="index.html">回到首頁</a></li>
                <li><a href="recommend.html">桌遊探索</a></li>
                <li><a href="quiz.html">桌遊問答</a></li>
                <li><a href="personality-test.html">桌友適性</a></li>
                <li><a href="explore.html">玩家數據</a></li>
                <li><a href="community.html">揪桌趣處</a></li>
                <li><a href="profile.html">我的檔案</a></li>
            </ul>
        </div>
    </nav>"""

out = f"""<!DOCTYPE html>
<!-- 主工具內容由 scripts/build_tier_maker_page.py 自 public/demo-tier-maker-v1-image.html 組出；請改 demo 後執行 python scripts/build_tier_maker_page.py -->
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🥇 桌遊排名圖 - MBTI × 桌遊配對</title>
    <link rel="stylesheet" href="css/styles.css">
    <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
    <style>
{style_block}
    </style>
</head>
<body>
{NAV}
    <div class="container">
        <div class="page-header">
            <h1 class="page-title">🥇 桌遊排名圖</h1>
            <p class="page-subtitle">製作可匯出的桌遊 Tier 排名圖（本機離線 + D1 搜尋；需後端以使用遊戲庫）。其他原型：<a href="demo-tier-maker-hub.html">示範總覽</a>。</p>
        </div>
        <div class="tier-maker-v1-page">
        <p class="hint" style="margin-bottom:1rem;">膠囊同 <a href="edit-games-drag.html">edit-games-drag</a>（<code>tables/game_database?search=</code>）。<strong>Tier 整張背景</strong>與<strong>格子內封面顯示</strong>分開設定（對齊 <a href="collection-poster.html">collection-poster</a>）。點格子上的 <strong>⚙</strong> 只改該格；待分區不會匯出。</p>
{main_html}
        </div>
    </div>

{popovers}

    <script>
{main_script}
    </script>
</body>
</html>
"""

(ROOT / "public/tier-maker.html").write_text(out, encoding="utf-8")
print("OK", len(out.splitlines()), "lines")
