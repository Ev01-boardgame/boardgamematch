# 遊戲 8 軸公式 + 測驗入口與寫入流程（你先看，確認後再動工）

## 一、測驗入口與寫入（你要的流程）

### 方案：雙入口 + 寫入時機

- **入口 1：現有「人格測驗」分頁**  
  - 維持現狀：使用者可以來這裡做 MBTI 風格 / 桌遊偏好。  
  - 做完後若**已登入**，結果頁多一個按鈕「**儲存到我的檔案**」，按下才寫入後端（`user_preference_profiles` 或 MBTI 存 `users.mbti_type`）。  
  - 若未登入，可顯示「登入後可儲存到我的檔案」，不寫入。

- **入口 2：「我的檔案」分頁**  
  - 在個人檔案頁顯示目前儲存的 **MBTI 類型** 與 **桌遊偏好 8 軸**（若沒有就顯示「尚未測驗」）。  
  - 提供兩顆操作：**「測 MBTI 風格」**、**「測桌遊偏好」**：  
    - 點下去可以**在該頁嵌入測驗流程**（同一套題目），或**開新分頁／彈窗**連到現有測驗頁並帶「return=profile」之類的參數，測完後自動儲存並關閉／回到我的檔案。  
  - 若已有結果，可提供**「重新測驗」**與**「編輯」**：  
    - **重新測驗**：再跑一次題目，測完後寫入（覆蓋）。  
    - **編輯**：例如 8 軸用輸入框／滑桿直接改數字，**儲存時寫入後端**（等同「修改時寫入」）。

- **寫入時機整理**  
  - 測驗完成 + 使用者按「儲存到我的檔案」→ 寫入。  
  - 在「我的檔案」做完測驗（或重新測驗）→ 寫入。  
  - 在「我的檔案」編輯 MBTI／8 軸後按儲存 → 寫入。  

這樣就滿足：**在分頁做測驗可寫入、在我的檔案可點選做測驗並寫入、也可在該頁編輯並在修改時寫入**。

---

## 二、遊戲 8 軸：不給玩家看，只拿來做推薦

- **前端**：不顯示遊戲的 8 軸雷達／數值給一般玩家。  
- **後端／推薦**：用「玩家 8 軸 + MBTI」搭配「同類型的人喜不喜歡 + 整體群體喜好產生的遊戲 8 軸」來做推薦。  
- **後台**：遊戲 8 軸要**可觀察、可微調**（例如在遊戲資料管理裡顯示並可編輯 8 軸欄位）。

---

## 三、遊戲 8 軸計算公式（加權 + 易學用難易度）

### 3.1 符號

- 遊戲 \(G\)，其 8 軸記為 \(A_G^{(k)}\)，\(k \in \{\text{conflict}, \text{strategy}, \text{social\_fun}, \text{immersion}, \text{accessibility}, \text{manipulation}, \text{coop}, \text{luck}\}\)。
- 「喜歡 \(G\)」的玩家集合：\(L_G\)（例如 super_like / like 的 user_id）。  
- 玩家 \(i\) 的 8 軸（來自 `user_preference_profiles`）：\(P_i^{(k)}\)，範圍 0～12（與測驗一致）。  
- 遊戲資料庫的難易度：\(C_G\)（例如 `game_database.complexity`，BGG weight 約 1～5）。

---

### 3.2 除「易學」外的 7 軸：加權平均（玩家軸越高，該軸加權越大）

你要的是：**該玩家在某一軸越高，當他喜歡這款遊戲時，這款遊戲在該軸得到的加權也越高**。

做法：用「該玩家在軸 \(k\) 的分數」當成該玩家對「遊戲在軸 \(k\)」的貢獻權重。

- 對軸 \(k\)（\(k \neq \text{accessibility}\)）：  
  \[
  A_G^{(k)} = \frac{\sum_{i \in L_G} P_i^{(k)} \cdot P_i^{(k)}}{\sum_{i \in L_G} P_i^{(k)}}
  = \frac{\sum_{i \in L_G} \bigl( P_i^{(k)} \bigr)^2}{\sum_{i \in L_G} P_i^{(k)}}
  \]
- 若 \(\sum_{i \in L_G} P_i^{(k)} = 0\)（沒人喜歡或大家該軸都是 0），則 \(A_G^{(k)} = 0\) 或維持 `NULL`（依實作約定）。

**意義**：策略軸很高的玩家喜歡 \(G\) 時，會把 \(G\) 的「策略」分數拉高；該軸低的玩家喜歡時，拉高效果較小。其他 7 軸同理。

**數值尺度**：算出來可能是 0～12 附近，若要對齊你後台或推薦用的 0～100，再線性縮放即可，例如：
\[
A_G^{(k),\text{scale}} = \frac{A_G^{(k)}}{12} \times 100.
\]

---

### 3.3 「易學」軸：玩家加權 + 遊戲難易度（難易度權重高）

- **易學**與「難易度」相反：難易度越高，易學越低。  
- 你希望：**易學軸要採用遊戲資料庫的難易度，且權重高一點**。

設：

- \(A_G^{(\text{acc}),\text{players}}\)：用上面同一套加權公式，只對 `accessibility` 軸算出來的「來自玩家的易學分數」。
- \(C_G\)：`game_database.complexity`，假設已正規化到 0～1（例如 BGG 1～5 → 除以 5）。  
  **易學**與難度相反，所以從難度換成「易學」：  
  \[
  E_G = 1 - C_G \quad \text{（或再乘 12 對齊 0～12）}
  \]
  若你要 0～100：\(E_G = (1 - C_G) \times 100\)。

**混合公式（易學權重：難易度較高）**：

\[
A_G^{(\text{accessibility})} = \alpha \cdot A_G^{(\text{acc}),\text{players}} + (1-\alpha) \cdot E_G
\]

- \(\alpha\)：玩家加權平均的權重（例如 0.2～0.35）。  
- \(1-\alpha\)：難易度轉成的易學的權重（例如 0.65～0.8），**比玩家權重大**。  
- 若沒有 \(C_G\)（NULL），可暫用 \(A_G^{(\text{accessibility})} = A_G^{(\text{acc}),\text{players}}\)，或 \(E_G\) 用全站平均難度代入。

**建議**：\(\alpha = 0.3\)，\(1-\alpha = 0.7\)，讓「遊戲資料庫難易度」主導易學軸。

---

### 3.4 公式總整理（給實作用）

1. **7 軸（conflict, strategy, social_fun, immersion, manipulation, coop, luck）**  
   \[
   A_G^{(k)} = \frac{\sum_{i \in L_G} \bigl( P_i^{(k)} \bigr)^2}{\sum_{i \in L_G} P_i^{(k)}} \quad \text{（若分母為 0 則為 0 或 NULL）}
   \]  
   可選：再乘上 \((100/12)\) 得到 0～100。

2. **易學（accessibility）**  
   - 玩家端：\(A_G^{(\text{acc}),\text{players}} = \frac{\sum_{i \in L_G} (P_i^{(\text{accessibility})})^2}{\sum_{i \in L_G} P_i^{(\text{accessibility})}}}\)（同上）。  
   - 難易度轉易學：\(E_G = (1 - C_G) \times 100\)（若 \(C_G\) 已 0～1）或 \(E_G = (1 - C_G/5) \times 100\)（若 BGG 1～5）。  
   - 混合：\(A_G^{(\text{accessibility})} = 0.3 \times A_G^{(\text{acc}),\text{players}} + 0.7 \times E_G\)。  
   - 若 \(C_G\) 為 NULL：\(A_G^{(\text{accessibility})} = A_G^{(\text{acc}),\text{players}}\)。

3. **推薦時**  
   - 玩家不會看到遊戲 8 軸；推薦邏輯用「玩家 8 軸 + MBTI」與「遊戲 8 軸 + 同類型喜好 + 群體喜好」算出**匹配度**，依匹配度排序／篩選推薦。易學軸已含資料庫難易度且權重較高。

---

## 四、遊戲資料庫欄位調整（你要的）

- **砍掉**：  
  - `description`（遊戲描述）  
  - `source`（資料來源）  

- **保留並使用**：  
  - `complexity`（難易度）：拿來算易學軸，權重高。  
  - 現有 8 軸欄位：`axis_conflict` … `axis_luck`：**後台可觀察並微調**，前端不顯示。

- **既有 DB 遷移**：  
  - `ALTER TABLE game_database DROP COLUMN description;`  
  - `ALTER TABLE game_database DROP COLUMN source;`  
  （若 D1 不支援 DROP COLUMN，就保留欄位但不再使用，或查 D1 文件用別的方式處理。）

---

## 五、推薦匹配度（評估「這款遊戲適不適合這位玩家」）

推薦時要算的是**匹配度**：綜合以下三者，產出一個分數或排序，用來決定「推哪些遊戲、順序如何」。

1. **玩家 8 軸 vs 遊戲 8 軸**  
   - 例如：兩邊 8 維向量做**餘弦相似度**或**加權歐氏距離**（愈像分數愈高／距離愈小）。  
   - 可依軸加權（例如策略、易學權重高一點），或先正規化再算。

2. **同類型（MBTI）喜好**  
   - 與玩家同 MBTI 的人，對該遊戲的 like/super_like 比例或平均分，當成「同類型匹配」分數。

3. **群體喜好**  
   - 全站對該遊戲的 like/super_like、投票數等，當成「熱門／群體認可」分數。

**匹配度公式（概念）**：  
\[
\text{匹配度}(G) = w_1 \cdot \text{sim}(\text{玩家 8 軸}, \text{遊戲 8 軸}) + w_2 \cdot \text{同類型喜好}(G) + w_3 \cdot \text{群體喜好}(G)
\]  
\(w_1, w_2, w_3\) 可調（例如 0.5, 0.3, 0.2）。實作時再定權重與正規化方式。

**實作**：`public/js/match-score.js` 提供 `MatchScore.computeMatchScore(playerAxes, game, sameTypeScore, groupScore, weights)`，回傳 0～100。推薦頁或任何列表可載入此 script 後依匹配度排序／篩選。

---

## 六、確認摘要（已 OK）

請你確認三件事：

1. **測驗入口與寫入**：  
   - 人格測驗分頁 + 「儲存到我的檔案」按鈕（登入才寫入）；  
   - 我的檔案可點「測 MBTI／測桌遊偏好」做測驗並寫入、可編輯並在儲存時寫入。  
   這樣是否符合你要的？

2. **公式**：  
   - 7 軸用加權平均 \(\sum (P_i^{(k)})^2 / \sum P_i^{(k)}\)；  
   - 易學 = 0.3×玩家易學 + 0.7×（由 complexity 轉成的易學），且 complexity 為 NULL 時只用工式玩家端。  
   權重或尺度要改嗎（例如 0.3/0.7、0～12 或 0～100）？

3. **遊戲資料庫**：  
   - 砍 `description`、`source`；  
   - 8 軸保留並在後台可觀察、可微調；  
   - 易學軸計算時用 `complexity` 且權重高。  
   是否就這樣做？

**你已確認**：  
- 推薦 = 評估**匹配度**（玩家 8 軸 + MBTI、遊戲 8 軸、同類型喜好、群體喜好）。  
- 測驗入口／寫入流程 OK。  
- 7 軸與易學公式、權重 0.3／0.7 OK。  
- 遊戲庫砍 description／source，8 軸只後台用 OK。  

要開始實作時再從 schema、寫入 API、匹配度公式依序做。

---

## 七、推薦頁定位與「隨機推薦」功能（討論結論）

### 7.1 現有 recommend 頁（桌遊探索）

- **定位**：以**清單內遊戲為導向**；使用者選一個 collection，在該清單內評價，排名也**只來自該清單**的 `collection_game_stats`（like_count / wishlist_count 等）。
- **結論**：**不接 8 軸／匹配度**，維持現狀（依 like_count、人氣、清單內排序）。匹配度與 8 軸改在「別的地方」用（例如之後的「為你推薦」或「隨機推薦」）。

### 7.2 隨機推薦（另做功能，之後實作）

- **功能**：提供一項 **[隨機推薦]**，可設定：
  - **純隨機**：不依人格與偏好，隨機挑遊戲。
  - **以 MBTI 性格評估**：同類型（同 MBTI）喜好參與篩選或加權。
  - **以 8 軸評估**：用玩家 8 軸 vs 遊戲 8 軸（＋同類型／群體喜好）的匹配度篩選或排序。
  - **MBTI and/or 8 軸**：可勾選其一或兩者都用（例如「只依 8 軸」「只依 MBTI」「兩者都要」）。
- **實作時**：可放在新頁（例如「為你推薦」）或現有某頁的區塊；載入 `match-score.js` 與使用者／遊戲資料後，依設定決定是否用 MBTI、8 軸或純隨機，再產出推薦列表。

---

## 八、遊戲 8 軸：何時／哪裡算、範圍（討論結論）

### 8.1 時機：選項乙（排程批次）

- **採用排程批次**，不做事件驅動（不在每次 like 時即時重算）。簡單、好維護，不需即時性。

### 8.2 在哪裡算（評估結論）

- **建議**：在 **Cloudflare Worker** 內實作「批次重算」邏輯，用 **Cron Trigger** 定期執行（例如每日一次或每 6 小時一次）。同一專案、同一 D1，不需另開服務。
- **替代**：若暫不開 Cron，可改為本機或 CI 用 **Wrangler** 定期呼叫一個「僅內網或帶 secret 的 API」（例如 `POST /internal/recalc-game-axes`），由該 API 執行同一套重算邏輯。
- **結論**：以 Worker + Cron 為主；若要「都做」，可同時保留一個手動/內部觸發的 API 供除錯或補跑。

### 8.3 範圍（評估結論）

- **只重算「有機會算出有意義 8 軸」的遊戲**：
  - 條件：該遊戲至少被一位使用者列為 **like 或 super_like**（從 `users.liked_games` / `users.super_liked_games` 或 `game_votes` 判斷），且這些使用者中至少有一位在 **user_preference_profiles** 有紀錄（有意願輪廓）。
- **實作**：先查出所有「在任一使用者的 liked_games / super_liked_games 中出現的遊戲名」→ 對每個遊戲找出「喜歡該遊戲且有意願輪廓」的 user_id 集合 \(L_G\) → 依既有公式算 7 軸與易學軸 → 寫回 `game_database.axis_*`。
- **未在範圍內**的遊戲（從未被喜歡、或喜歡的人都沒有偏好輪廓）：不更新，維持 NULL 或上次結果即可。

### 8.4 實作步驟摘要（排程批次）

1. 從 `users` 取出所有使用者的 `liked_games`、`super_liked_games`（或從 `game_votes` 彙總 like/super_like 的 game_name）。
2. 列出「至少被一人 like/super_like」的遊戲名集合。
3. 對每個遊戲 \(G\)：  
   - 查 `user_preference_profiles` 得到有輪廓的 user_id 集合，與 `users` 比對，得到「喜歡 \(G\) 且有意願輪廓」的 \(L_G\)。  
   - 若 \(L_G\) 為空，跳過或將該遊戲 8 軸設為 NULL。  
   - 7 軸：\(A_G^{(k)} = \sum (P_i^{(k)})^2 / \sum P_i^{(k)}\)；易學：0.3×玩家端 + 0.7×（由 `game_database.complexity` 轉易學），無 complexity 時只用玩家端。  
   - UPDATE `game_database`  SET axis_* = ... WHERE id = ?（或依 name_zh/name_en 對應到 id）。
4. 以 **Cron Trigger** 呼叫上述邏輯（或由內部 API 觸發）。

**實作**：  
- **Cron**：`wrangler.toml` 設定 `[triggers] crons = ["0 * * * *"]`（每小時整點）。Worker 匯出 `scheduled(event, env, ctx)`，內呼叫 `recalcGameAxes(env.DB)`。  
- **手動觸發**：`POST /internal/recalc-game-axes`，需帶與 tables API 相同的 `X-Api-Key`（或專用 secret），回傳 `{ ok, updated, errors }`。
