-- ============================================================
-- CK ANALYTICS PIPELINE — FINAL EXPORT QUERY
-- Run in SSMS → Results to Grid → Right-click → Save As CSV
-- File: CK_math_pipeline_data.csv
-- Save to: C:\Users\houstonp\Desktop\CK-Analytics-DB\
-- ============================================================
-- TABLES USED:
--   dbo.PS_TKT_HIST     (ticket header)
--   dbo.PS_TKT_HIST_LIN (ticket line detail)
--   dbo.IM_INV           (current inventory snapshot)
--
-- JOIN KEY: PS_TKT_HIST.DOC_ID = PS_TKT_HIST_LIN.DOC_ID
--
-- FILTERS:
--   - Last 90 days (primary) + 12 months (velocity)
--   - Stores: exclude 'HQ' and '100'
--   - Line type: 'S' (sales only)
--   - 21 categories (excludes DRINKS and non-retail)
--
-- MATH:
--   - Log transform: LN(QTY_SOLD), zero/negative → 0
--   - Sub-category stdev: computed on LN_QTY per CATEG_COD + SUBCAT_COD
--   - Z-score: (LN_QTY - mean) / stdev, only when peer count >= 3
--   - Rank: z-score based (3+ peers) or qty based (under 3 peers)
--   - Percentile: PERCENT_RANK() within sub-category
--   - Velocity: % of 12-month sales occurring in last 90 days
--   - Status: ACTIVE / OUT OF STOCK / NOT SELLING
--
-- COLUMN MAPPING TO DASHBOARD:
--   ITEM_NO             → Item #
--   ITEM_NAME           → Item name
--   CATEG_COD           → Category
--   SUBCAT_COD          → Sub category
--   RAW_QTY_90D         → 90-day sales KPI
--   RAW_AMT_90D         → 90-day sales $ KPI
--   RAW_QTY_12M_TOTAL   → 12-month sales total
--   PCT_RECENT          → Velocity indicator (25% = steady)
--   Z_SCORE             → Backend math (not displayed)
--   RANK_METHOD         → Z-SCORE or QTY-RANK
--   SUBCAT_RANK         → "X out of Y" rank badge
--   PERCENTILE          → "top X%" badge
--   SUBCAT_TOTAL        → Peer count for "X out of Y"
--   QTY_AVAIL_ALL_STORES→ Inventory grid
--   STORES_WITH_STOCK   → Inventory grid
--   STATUS              → ACTIVE / OUT OF STOCK / NOT SELLING
-- ============================================================

DECLARE @DATE_START_90 DATE = DATEADD(DAY, -90, CAST(GETDATE() AS DATE));
DECLARE @DATE_START_12M DATE = DATEADD(MONTH, -12, CAST(GETDATE() AS DATE));

WITH
-- ============================================================
-- STEP 1: Aggregate per item (90-day sales)
-- ============================================================
item_sales AS (
    SELECT
        l.ITEM_NO,
        MAX(l.DESCR)                          AS ITEM_NAME,
        MAX(l.CATEG_COD)                      AS CATEG_COD,
        MAX(l.SUBCAT_COD)                     AS SUBCAT_COD,
        SUM(l.QTY_SOLD)                       AS RAW_QTY_90D,
        SUM(l.EXT_PRC)                        AS RAW_AMT_90D,
        COUNT(DISTINCT l.DOC_ID)              AS TXN_COUNT,
        COUNT(DISTINCT l.STR_ID)              AS STORE_COUNT,
        CASE
            WHEN SUM(l.QTY_SOLD) > 0
            THEN LOG(SUM(l.QTY_SOLD))
            ELSE 0
        END                                   AS LN_QTY
    FROM dbo.PS_TKT_HIST_LIN l
        INNER JOIN dbo.PS_TKT_HIST h
            ON h.DOC_ID = l.DOC_ID
    WHERE l.BUS_DAT >= @DATE_START_90
      AND l.STR_ID NOT IN ('HQ', '100')
      AND l.LIN_TYP = 'S'
      AND l.CATEG_COD IN (
            'BABY', 'BALLOONS', 'COMFORT', 'DRINKWARE',
            'ELECTRONIC', 'FASHION', 'GAMES', 'GIFT BAG',
            'GIFTS', 'GREETCARD', 'HBA', 'INSPR',
            'KELLILOON', 'LOGOWEAR', 'MENS', 'NURSE',
            'PLUSH', 'SEASONAL', 'SNACKS', 'TOYS', 'WRITING'
      )
    GROUP BY l.ITEM_NO
),

-- ============================================================
-- STEP 2: 12-month sales for velocity comparison
-- ============================================================
item_sales_12m AS (
    SELECT
        l.ITEM_NO,
        SUM(l.QTY_SOLD)   AS RAW_QTY_12M,
        SUM(l.EXT_PRC)    AS RAW_AMT_12M
    FROM dbo.PS_TKT_HIST_LIN l
        INNER JOIN dbo.PS_TKT_HIST h
            ON h.DOC_ID = l.DOC_ID
    WHERE l.BUS_DAT >= @DATE_START_12M
      AND l.BUS_DAT < @DATE_START_90
      AND l.STR_ID NOT IN ('HQ', '100')
      AND l.LIN_TYP = 'S'
      AND l.CATEG_COD IN (
            'BABY', 'BALLOONS', 'COMFORT', 'DRINKWARE',
            'ELECTRONIC', 'FASHION', 'GAMES', 'GIFT BAG',
            'GIFTS', 'GREETCARD', 'HBA', 'INSPR',
            'KELLILOON', 'LOGOWEAR', 'MENS', 'NURSE',
            'PLUSH', 'SEASONAL', 'SNACKS', 'TOYS', 'WRITING'
      )
    GROUP BY l.ITEM_NO
),

-- ============================================================
-- STEP 3: Sub-category statistics (mean + stdev of LN_QTY)
-- ============================================================
subcat_stats AS (
    SELECT
        CATEG_COD,
        SUBCAT_COD,
        COUNT(*)           AS PEER_COUNT,
        AVG(LN_QTY)        AS SUBCAT_MEAN_LN,
        CASE
            WHEN COUNT(*) >= 3
            THEN STDEV(LN_QTY)
            ELSE NULL
        END                AS SUBCAT_STDEV_LN
    FROM item_sales
    WHERE SUBCAT_COD IS NOT NULL
    GROUP BY CATEG_COD, SUBCAT_COD
),

-- ============================================================
-- STEP 4: Current inventory from IM_INV
-- ============================================================
inventory AS (
    SELECT
        ITEM_NO,
        SUM(QTY_AVAIL)                                    AS QTY_AVAIL_ALL_STORES,
        SUM(QTY_ON_HND)                                   AS QTY_ON_HND_ALL_STORES,
        SUM(CASE WHEN QTY_AVAIL > 0 THEN 1 ELSE 0 END)   AS STORES_WITH_STOCK
    FROM dbo.IM_INV
    WHERE LOC_ID NOT IN ('HQ', '100')
    GROUP BY ITEM_NO
),

-- ============================================================
-- STEP 5: Z-scores + ranking
-- ============================================================
scored AS (
    SELECT
        i.ITEM_NO,
        i.ITEM_NAME,
        i.CATEG_COD,
        i.SUBCAT_COD,
        i.RAW_QTY_90D,
        i.RAW_AMT_90D,
        i.TXN_COUNT,
        i.STORE_COUNT,
        i.LN_QTY,

        -- 12-month totals
        ISNULL(m.RAW_QTY_12M, 0) + i.RAW_QTY_90D         AS RAW_QTY_12M_TOTAL,
        ISNULL(m.RAW_AMT_12M, 0) + i.RAW_AMT_90D         AS RAW_AMT_12M_TOTAL,

        -- Velocity: % of 12-month sales in last 90 days
        CASE
            WHEN (ISNULL(m.RAW_QTY_12M, 0) + i.RAW_QTY_90D) > 0
            THEN ROUND(
                CAST(i.RAW_QTY_90D AS FLOAT)
                / (ISNULL(m.RAW_QTY_12M, 0) + i.RAW_QTY_90D) * 100
            , 1)
            ELSE 0
        END                                                AS PCT_RECENT,

        -- Sub-category stats
        s.PEER_COUNT,
        s.SUBCAT_MEAN_LN,
        s.SUBCAT_STDEV_LN,

        -- Z-score
        CASE
            WHEN s.PEER_COUNT >= 3 AND s.SUBCAT_STDEV_LN > 0
            THEN ROUND((i.LN_QTY - s.SUBCAT_MEAN_LN) / s.SUBCAT_STDEV_LN, 4)
            ELSE NULL
        END                                                AS Z_SCORE,

        -- Ranking method
        CASE
            WHEN s.PEER_COUNT >= 3 AND s.SUBCAT_STDEV_LN > 0
            THEN 'Z-SCORE'
            ELSE 'QTY-RANK'
        END                                                AS RANK_METHOD,

        -- Inventory
        ISNULL(inv.QTY_AVAIL_ALL_STORES, 0)               AS QTY_AVAIL_ALL_STORES,
        ISNULL(inv.QTY_ON_HND_ALL_STORES, 0)              AS QTY_ON_HND_ALL_STORES,
        ISNULL(inv.STORES_WITH_STOCK, 0)                   AS STORES_WITH_STOCK,

        -- Status
        CASE
            WHEN i.RAW_QTY_90D > 0 THEN 'ACTIVE'
            WHEN i.RAW_QTY_90D <= 0 AND ISNULL(inv.QTY_AVAIL_ALL_STORES, 0) <= 0
                THEN 'OUT OF STOCK'
            WHEN i.RAW_QTY_90D <= 0 AND ISNULL(inv.QTY_AVAIL_ALL_STORES, 0) > 0
                THEN 'NOT SELLING'
            ELSE 'UNKNOWN'
        END                                                AS STATUS

    FROM item_sales i
        LEFT JOIN item_sales_12m m ON i.ITEM_NO = m.ITEM_NO
        LEFT JOIN subcat_stats s
            ON i.CATEG_COD = s.CATEG_COD
           AND i.SUBCAT_COD = s.SUBCAT_COD
        LEFT JOIN inventory inv ON i.ITEM_NO = inv.ITEM_NO
)

-- ============================================================
-- FINAL OUTPUT with rank + percentile
-- ============================================================
SELECT
    ITEM_NO,
    ITEM_NAME,
    CATEG_COD,
    SUBCAT_COD,
    RAW_QTY_90D,
    RAW_AMT_90D,
    RAW_QTY_12M_TOTAL,
    RAW_AMT_12M_TOTAL,
    PCT_RECENT,
    TXN_COUNT,
    STORE_COUNT,
    LN_QTY,
    PEER_COUNT,
    SUBCAT_MEAN_LN,
    SUBCAT_STDEV_LN,
    Z_SCORE,
    RANK_METHOD,

    -- Rank within sub-category
    CASE
        WHEN RANK_METHOD = 'Z-SCORE'
        THEN ROW_NUMBER() OVER (
            PARTITION BY CATEG_COD, SUBCAT_COD
            ORDER BY Z_SCORE DESC
        )
        ELSE ROW_NUMBER() OVER (
            PARTITION BY CATEG_COD, SUBCAT_COD
            ORDER BY RAW_QTY_90D DESC
        )
    END                                                    AS SUBCAT_RANK,

    -- Percentile within sub-category
    CASE
        WHEN RANK_METHOD = 'Z-SCORE'
        THEN ROUND(
            PERCENT_RANK() OVER (
                PARTITION BY CATEG_COD, SUBCAT_COD
                ORDER BY Z_SCORE ASC
            ) * 100, 1
        )
        ELSE ROUND(
            PERCENT_RANK() OVER (
                PARTITION BY CATEG_COD, SUBCAT_COD
                ORDER BY RAW_QTY_90D ASC
            ) * 100, 1
        )
    END                                                    AS PERCENTILE,

    PEER_COUNT                                             AS SUBCAT_TOTAL,
    QTY_AVAIL_ALL_STORES,
    QTY_ON_HND_ALL_STORES,
    STORES_WITH_STOCK,
    STATUS

FROM scored
WHERE SUBCAT_COD IS NOT NULL

ORDER BY CATEG_COD, SUBCAT_COD, SUBCAT_RANK;